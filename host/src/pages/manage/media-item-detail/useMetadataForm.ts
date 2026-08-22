/**
 * 媒体资源「元数据编辑」表单状态。
 *
 * 三条非显而易见的决策：
 *
 * 1. 表单以 `effectiveMetadata`（本地覆盖合并后的最终生效值）为初值，而不是
 *    `baseMetadata`。管理员在这里看到的就是前台实际展示的内容，改动语义直观。
 *
 * 2. 提交时把「当前可编辑的全部字段」整份送出，而不是只送改动过的字段。
 *    后端这个接口写的是一份完整的本地覆盖记录，整份提交能保证「所见即所存」；
 *    文本字段被清空时送空串（而不是省略该键），这样无论后端把缺失键理解为
 *    「不修改」还是「置空」，用户的清空操作都能真正落地。年份与评分是数值
 *    字段，留空时只能省略 —— 这是类型契约本身的边界。
 *
 * 3. 服务端数据变化时在渲染期同步草稿（React 官方的「随 props 调整 state」写法），
 *    不用 useEffect：页面上传封面、上传字幕都会刷新同一份 detail 缓存，若用
 *    副作用同步会先渲染一帧错误状态。同步规则分三种情况：
 *      - 用户没动过表单 → 直接跟进服务端；
 *      - 用户的草稿正好等于服务端新值（刚保存成功）→ 静默收敛，不再显示未保存；
 *      - 两者都不成立 → 保留草稿并亮出冲突提示，由用户决定要不要放弃。
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  ManageMediaItemMetadataRecord,
  UpdateManageMediaItemMetadataRequest,
} from '@fmby/v2-shared/contracts/manage/media-items';
import { toDateInputValue } from './formatters';

export interface MetadataActorDraft {
  /** 仅用于 React key，不参与提交与比较。 */
  key: string;
  name: string;
  role: string;
  /** 原记录里的头像与档案链接，本表单不编辑但必须原样带回，避免保存后丢失。 */
  thumbUrl?: string;
  profile?: string;
}

export interface MetadataFormState {
  title: string;
  originalTitle: string;
  sortTitle: string;
  year: string;
  premiered: string;
  communityRating: string;
  overview: string;
  genres: string;
  directors: string;
  studios: string;
  actors: MetadataActorDraft[];
}

export type MetadataFormErrors = Partial<
  Record<'title' | 'year' | 'communityRating', string>
>;

export type MetadataTextField = Exclude<keyof MetadataFormState, 'actors'>;

let actorKeySeed = 0;

function nextActorKey(): string {
  actorKeySeed += 1;
  return `actor-${actorKeySeed}`;
}

/** 逗号 / 顿号 / 分号都当成分隔符，管理员不用记规则。 */
function splitList(value: string): string[] {
  return value
    .split(/[,，、;；]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function toFormState(metadata: ManageMediaItemMetadataRecord): MetadataFormState {
  return {
    title: metadata.title ?? '',
    originalTitle: metadata.originalTitle ?? '',
    sortTitle: metadata.sortTitle ?? '',
    year: metadata.year !== undefined ? String(metadata.year) : '',
    premiered: toDateInputValue(metadata.premiered),
    communityRating:
      metadata.communityRating !== undefined ? String(metadata.communityRating) : '',
    overview: metadata.overview ?? '',
    genres: metadata.genres.join('、'),
    directors: metadata.directors.join('、'),
    studios: metadata.studios.join('、'),
    actors: metadata.actors.map((actor) => ({
      key: nextActorKey(),
      name: actor.name,
      role: actor.role ?? '',
      thumbUrl: actor.thumbUrl,
      profile: actor.profile,
    })),
  };
}

/** 结构比较：actors 的 key 只是渲染用的，不参与比较。 */
function isSameForm(left: MetadataFormState, right: MetadataFormState): boolean {
  const sameScalars =
    left.title === right.title &&
    left.originalTitle === right.originalTitle &&
    left.sortTitle === right.sortTitle &&
    left.year === right.year &&
    left.premiered === right.premiered &&
    left.communityRating === right.communityRating &&
    left.overview === right.overview &&
    left.genres === right.genres &&
    left.directors === right.directors &&
    left.studios === right.studios;

  if (!sameScalars || left.actors.length !== right.actors.length) {
    return false;
  }

  return left.actors.every((actor, index) => {
    const other = right.actors[index];
    return (
      actor.name === other.name &&
      actor.role === other.role &&
      actor.thumbUrl === other.thumbUrl &&
      actor.profile === other.profile
    );
  });
}

function validate(form: MetadataFormState): MetadataFormErrors {
  const errors: MetadataFormErrors = {};

  if (form.title.trim() === '') {
    errors.title = '标题不能为空，前台列表与播放页都依赖它。';
  }

  if (form.year.trim() !== '') {
    const year = Number(form.year);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) {
      errors.year = '请填写四位数年份，例如 2024。';
    }
  }

  if (form.communityRating.trim() !== '') {
    const rating = Number(form.communityRating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
      errors.communityRating = '评分范围是 0 到 10。';
    }
  }

  return errors;
}

function buildPayload(form: MetadataFormState): UpdateManageMediaItemMetadataRequest {
  return {
    title: form.title.trim(),
    originalTitle: form.originalTitle.trim(),
    sortTitle: form.sortTitle.trim(),
    year: form.year.trim() === '' ? undefined : Number(form.year),
    overview: form.overview.trim(),
    communityRating:
      form.communityRating.trim() === '' ? undefined : Number(form.communityRating),
    genres: splitList(form.genres),
    directors: splitList(form.directors),
    studios: splitList(form.studios),
    actors: form.actors
      .filter((actor) => actor.name.trim() !== '')
      .map((actor) => ({
        name: actor.name.trim(),
        role: actor.role.trim() === '' ? undefined : actor.role.trim(),
        thumbUrl: actor.thumbUrl,
        profile: actor.profile,
      })),
    premiered: form.premiered.trim(),
  };
}

export interface UseMetadataFormResult {
  form: MetadataFormState;
  errors: MetadataFormErrors;
  /** 草稿与服务端当前值不一致。 */
  isDirty: boolean;
  canSubmit: boolean;
  /** 服务端元数据已变化，但草稿与之冲突，因此没有自动跟进。 */
  hasRemoteDrift: boolean;
  setField: (field: MetadataTextField, value: string) => void;
  updateActor: (key: string, patch: Partial<Omit<MetadataActorDraft, 'key'>>) => void;
  addActor: () => void;
  removeActor: (key: string) => void;
  /** 丢弃草稿，回到服务端当前值。 */
  resetToRemote: () => void;
  buildPayload: () => UpdateManageMediaItemMetadataRequest;
}

export function useMetadataForm(
  metadata: ManageMediaItemMetadataRecord,
): UseMetadataFormResult {
  const remoteForm = useMemo(() => toFormState(metadata), [metadata]);
  const [syncedRemote, setSyncedRemote] = useState<MetadataFormState>(remoteForm);
  const [form, setForm] = useState<MetadataFormState>(remoteForm);
  const [driftNotice, setDriftNotice] = useState(false);

  // 渲染期同步（见文件顶部第 3 条）：条件收敛，不会形成循环。
  if (!isSameForm(syncedRemote, remoteForm)) {
    const userTouched = !isSameForm(form, syncedRemote);
    const draftMatchesRemote = isSameForm(form, remoteForm);
    setSyncedRemote(remoteForm);
    if (!userTouched) {
      setForm(remoteForm);
      setDriftNotice(false);
    } else {
      setDriftNotice(!draftMatchesRemote);
    }
  }

  const setField = useCallback((field: MetadataTextField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const updateActor = useCallback(
    (key: string, patch: Partial<Omit<MetadataActorDraft, 'key'>>) => {
      setForm((current) => ({
        ...current,
        actors: current.actors.map((actor) =>
          actor.key === key ? { ...actor, ...patch } : actor,
        ),
      }));
    },
    [],
  );

  const addActor = useCallback(() => {
    setForm((current) => ({
      ...current,
      actors: [...current.actors, { key: nextActorKey(), name: '', role: '' }],
    }));
  }, []);

  const removeActor = useCallback((key: string) => {
    setForm((current) => ({
      ...current,
      actors: current.actors.filter((actor) => actor.key !== key),
    }));
  }, []);

  const resetToRemote = useCallback(() => {
    setForm(remoteForm);
    setDriftNotice(false);
  }, [remoteForm]);

  const errors = validate(form);
  const isDirty = !isSameForm(form, remoteForm);

  return {
    form,
    errors,
    isDirty,
    canSubmit: isDirty && Object.keys(errors).length === 0,
    hasRemoteDrift: driftNotice && isDirty,
    setField,
    updateActor,
    addActor,
    removeActor,
    resetToRemote,
    buildPayload: () => buildPayload(form),
  };
}
