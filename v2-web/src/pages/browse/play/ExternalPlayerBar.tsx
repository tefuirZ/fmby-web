import { MonitorPlay, Play, Sparkles } from 'lucide-react';
import styles from '../PlayPage.module.css';

interface ExternalPlayerDef {
  name: string;
  icon: typeof Play;
  buildUri: (streamUrl: string) => string;
}

const EXTERNAL_PLAYERS: ExternalPlayerDef[] = [
  {
    name: 'PotPlayer',
    icon: MonitorPlay,
    buildUri: (url) => `potplayer://${url}`,
  },
  {
    name: 'VLC',
    icon: Play,
    buildUri: (url) => `vlc://${url}`,
  },
  {
    name: 'IINA',
    icon: Play,
    buildUri: (url) => `iina://weblink?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'nPlayer',
    icon: Play,
    buildUri: (url) => {
      if (url.startsWith('https://')) return url.replace('https://', 'nplayer-https://');
      return url.replace('http://', 'nplayer-http://');
    },
  },
  {
    name: 'Infuse',
    icon: Sparkles,
    buildUri: (url) => `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'MX Player',
    icon: Play,
    buildUri: (url) =>
      `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;end`,
  },
];

export function ExternalPlayerBar({ streamUrl }: { streamUrl: string }) {
  return (
    <div className={styles.playerBar}>
      <span className={styles.playerBarLabel}>用外部播放器打开：</span>
      <div className={styles.playerBarButtons}>
        {EXTERNAL_PLAYERS.map((player) => {
          const Icon = player.icon;
          return (
            <a
              key={player.name}
              className={styles.playerBarBtn}
              href={player.buildUri(streamUrl)}
              title={`在 ${player.name} 中打开`}
            >
              <Icon size={14} />
              {player.name}
            </a>
          );
        })}
      </div>
    </div>
  );
}
