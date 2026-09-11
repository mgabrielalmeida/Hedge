import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, FormFeedback, Text, useSuccessFeedback } from '@/components';
import { BackupError, createBackupBytes, restoreBackupBytes } from '@/db/backup';
import { useTheme } from '@/theme/ThemeProvider';

import { pickBackupFile, shareBackupFile } from './backupFiles';

export function BackupSection() {
  const database = useSQLiteContext();
  const { showSuccess } = useSuccessFeedback();
  const { reloadPreferences, tokens } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<'export' | 'restore' | null>(null);

  async function exportBackup() {
    setOperation('export');
    setError(null);

    try {
      const createdAt = new Date();
      const contents = await createBackupBytes(database, createdAt);
      await shareBackupFile(contents, createdAt);
      showSuccess('Arquivo de backup preparado.');
    } catch (caught) {
      setError(errorMessage(caught, 'O backup não pôde ser exportado. Tente novamente.'));
    } finally {
      setOperation(null);
    }
  }

  async function chooseBackup() {
    setOperation('restore');
    setError(null);

    try {
      const selected = await pickBackupFile();
      if (!selected) return;

      Alert.alert(
        'Restaurar este backup?',
        `O arquivo “${selected.name}” substituirá todas as contas, categorias, lançamentos, recorrências, tema e preferências atuais.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: () => void restoreSelectedBackup(selected.bytes),
          },
        ],
      );
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível abrir o arquivo selecionado.'));
    } finally {
      setOperation(null);
    }
  }

  async function restoreSelectedBackup(contents: Uint8Array) {
    setOperation('restore');
    setError(null);

    try {
      await restoreBackupBytes(database, contents);
      await reloadPreferences();
      showSuccess('Backup restaurado.');
    } catch (caught) {
      setError(errorMessage(caught, 'O backup não pôde ser restaurado. Seus dados anteriores foram mantidos.'));
    } finally {
      setOperation(null);
    }
  }

  const isBusy = operation !== null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text variant="title">Backup</Text>
        <Text tone="muted">
          Salve seus dados e preferências em um arquivo ou restaure uma cópia anterior.
        </Text>
        <Text tone="warning" variant="caption">
          O arquivo não é criptografado. Guarde-o em um local seguro.
        </Text>
      </View>

      <Card>
        <Text variant="title">Exportar backup</Text>
        <Text tone="muted" style={{ marginTop: tokens.spacing.xs }}>
          Cria um arquivo único para guardar no aparelho, nuvem ou outro aplicativo.
        </Text>
        <Button
          disabled={isBusy}
          label={operation === 'export' ? 'Preparando…' : 'Exportar backup'}
          onPress={() => void exportBackup()}
          style={{ marginTop: tokens.spacing.md }}
          variant="secondary"
        />
      </Card>

      <Card>
        <Text variant="title">Restaurar backup</Text>
        <Text tone="muted" style={{ marginTop: tokens.spacing.xs }}>
          A restauração substitui integralmente os dados e preferências atuais.
        </Text>
        <Button
          disabled={isBusy}
          label={operation === 'restore' ? 'Aguarde…' : 'Selecionar arquivo'}
          onPress={() => void chooseBackup()}
          style={{ marginTop: tokens.spacing.md }}
          variant="destructive"
        />
      </Card>

      {error ? <FormFeedback message={error} title="Falha no backup" /> : null}
    </View>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof BackupError || error instanceof Error) return error.message;
  return fallback;
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
  section: { gap: 12 },
});
