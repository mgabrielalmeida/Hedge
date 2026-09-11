import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const BACKUP_EXTENSION = '.hedge-backup';
const BACKUP_MIME_TYPE = 'application/octet-stream';
export const MAX_BACKUP_FILE_SIZE = 100 * 1024 * 1024;

export async function shareBackupFile(
  contents: Uint8Array,
  createdAt = new Date(),
): Promise<void> {
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('O compartilhamento de arquivos não está disponível neste aparelho.');
  }

  const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');
  const file = new File(Paths.cache, `hedge-${timestamp}${BACKUP_EXTENSION}`);

  try {
    file.create({ overwrite: true });
    file.write(contents);
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Salvar backup do Hedge',
      mimeType: BACKUP_MIME_TYPE,
      UTI: 'public.data',
    });
  } finally {
    if (file.exists) file.delete();
  }
}

export async function pickBackupFile(): Promise<{
  bytes: Uint8Array;
  name: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });

  if (result.canceled) return null;
  const asset = result.assets[0];

  if (asset.size !== undefined && asset.size > MAX_BACKUP_FILE_SIZE) {
    throw new Error('O arquivo selecionado excede o limite de 100 MB.');
  }
  if (!asset.name.toLowerCase().endsWith(BACKUP_EXTENSION)) {
    throw new Error('Selecione um arquivo com a extensão .hedge-backup.');
  }

  const file = new File(asset.uri);
  const bytes = await file.bytes();
  if (bytes.byteLength > MAX_BACKUP_FILE_SIZE) {
    throw new Error('O arquivo selecionado excede o limite de 100 MB.');
  }

  return { bytes, name: asset.name };
}
