import { doc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { DEFAULT_SAVED_PLATES, SavedLicensePlate } from '../types/report';
import { getOrCreateClientId } from './realtimeReportSync';

const SETTINGS_COLLECTION = 'app_settings';
const SAVED_PLATES_DOC_ID = 'saved_plates';

export interface CloudSavedPlatesDoc {
  plates: SavedLicensePlate[];
  deletedTargas: string[];
  updatedAt: number;
  updatedAtIso: string;
  updatedBy: string;
  clientId: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore SavedPlates Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export function normalizePlateKey(targa: string): string {
  return (targa || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function sanitizeSavedPlate(plate: SavedLicensePlate): SavedLicensePlate {
  const clean: SavedLicensePlate = {
    id: plate.id || `plate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targa: normalizePlateKey(plate.targa),
    isDefaultSbarra1: Boolean(plate.isDefaultSbarra1),
    isDefaultSbarra2: Boolean(plate.isDefaultSbarra2),
  };
  if (plate.label && plate.label.trim()) {
    clean.label = plate.label.trim();
  }
  return clean;
}

/**
 * Unisce le targhe fisse locali (es. inserite su smartphone) con quelle salvate su Firestore,
 * preservando sempre tutte le targhe non esplicitamente eliminate.
 */
export function mergeSavedPlates(
  localPlates: SavedLicensePlate[],
  remotePlates: SavedLicensePlate[],
  deletedTargas: string[] = []
): { merged: SavedLicensePlate[]; needsPushToCloud: boolean } {
  const deletedSet = new Set(deletedTargas.map((t) => normalizePlateKey(t)).filter(Boolean));
  const map = new Map<string, SavedLicensePlate>();

  // 1. Carica prima le targhe remote (se non eliminate)
  (remotePlates || []).forEach((rp) => {
    if (!rp || !rp.targa) return;
    const key = normalizePlateKey(rp.targa);
    if (!key || deletedSet.has(key)) return;
    map.set(key, sanitizeSavedPlate(rp));
  });

  // 2. Integra le targhe locali non presenti nel cloud (es. salvate su smartphone prima della sync)
  let needsPushToCloud = false;
  (localPlates || []).forEach((lp) => {
    if (!lp || !lp.targa) return;
    const key = normalizePlateKey(lp.targa);
    if (!key || deletedSet.has(key)) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, sanitizeSavedPlate(lp));
      needsPushToCloud = true;
    } else {
      const mergedLabel = existing.label || (lp.label ? lp.label.trim() : undefined);
      const mergedItem: SavedLicensePlate = {
        ...existing,
        ...(mergedLabel ? { label: mergedLabel } : {}),
        isDefaultSbarra1: Boolean(existing.isDefaultSbarra1 || lp.isDefaultSbarra1),
        isDefaultSbarra2: Boolean(existing.isDefaultSbarra2 || lp.isDefaultSbarra2),
      };
      map.set(key, mergedItem);
    }
  });

  // Garantisci che le targhe di default siano presenti se non eliminate
  DEFAULT_SAVED_PLATES.forEach((defPlate) => {
    const key = normalizePlateKey(defPlate.targa);
    if (!deletedSet.has(key) && !map.has(key)) {
      map.set(key, sanitizeSavedPlate(defPlate));
    }
  });

  // Assicura unicità dei flag default Sbarra 1 e Sbarra 2
  const result = Array.from(map.values());
  let seenDef1 = false;
  let seenDef2 = false;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].isDefaultSbarra1) {
      if (seenDef1) result[i].isDefaultSbarra1 = false;
      else seenDef1 = true;
    }
    if (result[i].isDefaultSbarra2) {
      if (seenDef2) result[i].isDefaultSbarra2 = false;
      else seenDef2 = true;
    }
  }

  return { merged: result, needsPushToCloud };
}

export async function pushSavedPlatesToCloud(
  plates: SavedLicensePlate[],
  deletedTargas: string[],
  userLabel: string
): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${SAVED_PLATES_DOC_ID}`;
  try {
    const now = Date.now();
    const cleanPlates = (plates || [])
      .filter((p) => p && p.targa && p.targa.trim())
      .map(sanitizeSavedPlate);
    const cleanDeleted = Array.from(
      new Set((deletedTargas || []).map((t) => normalizePlateKey(t)).filter(Boolean))
    );

    const payload: CloudSavedPlatesDoc = JSON.parse(
      JSON.stringify({
        plates: cleanPlates,
        deletedTargas: cleanDeleted,
        updatedAt: now,
        updatedAtIso: new Date(now).toISOString(),
        updatedBy: userLabel || 'Collaboratore',
        clientId: getOrCreateClientId(),
      })
    );

    await setDoc(doc(db, SETTINGS_COLLECTION, SAVED_PLATES_DOC_ID), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function verifyFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, SETTINGS_COLLECTION, SAVED_PLATES_DOC_ID));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client is offline).');
    }
  }
}

export function subscribeToSavedPlates(
  getLocalPlates: () => SavedLicensePlate[],
  getLocalDeletedTargas: () => string[],
  getAuthorLabel: () => string,
  onMergedUpdate: (plates: SavedLicensePlate[], deletedTargas: string[]) => void
): () => void {
  const path = `${SETTINGS_COLLECTION}/${SAVED_PLATES_DOC_ID}`;
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SAVED_PLATES_DOC_ID);
    const myClientId = getOrCreateClientId();

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        const localPlates = getLocalPlates();
        const localDeleted = getLocalDeletedTargas();

        if (!snap.exists()) {
          // Prima inizializzazione: carica nel cloud le targhe già memorizzate localmente (preservando i dati utente)
          const { merged } = mergeSavedPlates(localPlates, [], localDeleted);
          onMergedUpdate(merged, localDeleted);
          pushSavedPlatesToCloud(merged, localDeleted, getAuthorLabel()).catch(() => {});
          return;
        }

        const data = snap.data() as Partial<CloudSavedPlatesDoc> | undefined;
        const remotePlates = Array.isArray(data?.plates) ? data.plates : [];
        const remoteDeleted = Array.isArray(data?.deletedTargas)
          ? data.deletedTargas.map((t) => normalizePlateKey(t)).filter(Boolean)
          : [];

        // Se l'aggiornamento arriva da questo stesso client, allinea comunque lo stato senza loop
        if (data?.clientId && data.clientId === myClientId) {
          return;
        }

        const remotePlateKeys = new Set(
          remotePlates.map((p) => normalizePlateKey(p.targa)).filter(Boolean)
        );
        // Unione sicura: le cancellazioni sul cloud prevalgono per evitare ripristini indesiderati,
        // ma una targa presente attivamente sul cloud e non presente nei deletedTargas remoti viene mantenuta.
        const combinedDeleted = Array.from(
          new Set([
            ...remoteDeleted,
            ...localDeleted.filter((t) => !remotePlateKeys.has(normalizePlateKey(t))),
          ])
        );

        const { merged, needsPushToCloud } = mergeSavedPlates(
          localPlates,
          remotePlates,
          combinedDeleted
        );

        onMergedUpdate(merged, remoteDeleted.length > 0 ? remoteDeleted : combinedDeleted);

        // Se questo dispositivo aveva targhe extra non ancora presenti su Firestore, propagale al cloud per il PC/altri dispositivi
        if (needsPushToCloud) {
          pushSavedPlatesToCloud(merged, combinedDeleted, getAuthorLabel()).catch(() => {});
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return unsub;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return () => {};
  }
}
