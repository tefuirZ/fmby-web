import type { ItemDetailResponse } from '@fmby/v2-shared/contracts/browse/item';
import { HoverScrollArea } from '@fmby/v2-shared/ui';
import detailStyles from '../../styles/detail.module.css';
import sharedStyles from '../../styles/shared.module.css';
import { PersonCard } from './PersonCard';

interface ItemDetailPeopleSectionProps {
  item: ItemDetailResponse;
}

export function ItemDetailPeopleSection({ item }: ItemDetailPeopleSectionProps) {
  return (
    <section className={detailStyles.detailInfoCard}>
      <h2 className={sharedStyles.sectionTitle}>演员与主创</h2>
      <div className={detailStyles.peopleSectionBody}>
        {item.directorPeople.length > 0 ? (
          <div>
            <h3 className={detailStyles.detailSubsectionTitle}>导演</h3>
            <HoverScrollArea axis="x" delayMs={0} className={detailStyles.peopleRail}>
              {item.directorPeople.map((person, index) => (
                <PersonCard key={person.id ?? `director-${person.name}-${index}`} person={person} />
              ))}
            </HoverScrollArea>
          </div>
        ) : null}
        {item.actors.length > 0 ? (
          <div>
            <h3 className={detailStyles.detailSubsectionTitle}>演员</h3>
            <HoverScrollArea axis="x" delayMs={0} className={detailStyles.peopleRail}>
              {item.actors.map((person, index) => (
                <PersonCard key={person.id ?? `actor-${person.name}-${index}`} person={person} />
              ))}
            </HoverScrollArea>
          </div>
        ) : null}
      </div>
    </section>
  );
}
