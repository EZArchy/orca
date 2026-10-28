import { Text, View } from 'react-native'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { colors, typography } from '../theme/mobile-theme'
import { useMobileColorScheme } from '../theme/use-mobile-color-scheme'
import { themedStyleSheet } from '../theme/themed-styles'
import {
  mobileDictationStatusTitle,
  type MobileDictationStatusFlags
} from './MobileDictationStatusAnnouncement'

type MobileTerminalLiveInputStatusProps = {
  readonly dictation: MobileDictationStatusFlags
  readonly dictationMode: string | undefined
  readonly isAttaching: boolean
  readonly liveInputText: string
}

export function MobileTerminalLiveInputStatus({
  dictation,
  dictationMode,
  isAttaching,
  liveInputText
}: MobileTerminalLiveInputStatusProps) {
  const t = useMobileTranslation()
  useMobileColorScheme()
  const title =
    mobileDictationStatusTitle(dictation) ??
    t('session.terminalLiveInputStatus.liveInput', 'Live input')
  const detail = dictation.isRecording
    ? dictationMode === 'hold'
      ? t('session.terminalLiveInputStatus.releaseMicHint', 'Release mic to stop')
      : t('session.terminalLiveInputStatus.stopHint', 'Tap mic to stop')
    : dictation.isProcessing
      ? t('session.terminalLiveInputStatus.transcribing', 'Transcribing on desktop')
      : dictation.isStarting
        ? t('session.terminalLiveInputStatus.preparingMic', 'Preparing microphone')
        : isAttaching
          ? t('session.terminalLiveInputStatus.uploadingImage', 'Uploading image to host')
          : liveInputText ||
            t('session.terminalLiveInputStatus.keyboardHint', 'Tap to show keyboard')

  return (
    <View style={styles.status}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.detail} numberOfLines={1} ellipsizeMode="head">
        {detail}
      </Text>
    </View>
  )
}

const styles = themedStyleSheet(() => ({
  status: {
    flex: 1,
    gap: 1
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontWeight: '600'
  },
  detail: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontFamily: typography.monoFamily
  }
}))
