import { buildSafeBackgroundStyle } from './utils';
import heroStyles from '../styles/hero.module.css';

export function AdaptiveWideBackdrop({
  imageUrl,
  onError,
}: {
  imageUrl: string;
  onError?: () => void;
}) {
  return (
    <div className={heroStyles.heroBackground}>
      <div className={heroStyles.heroBackgroundBlur} style={buildSafeBackgroundStyle(imageUrl)} />
      <div className={heroStyles.heroBackgroundFrame}>
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className={heroStyles.heroBackgroundImage}
          onError={onError}
        />
      </div>
    </div>
  );
}
