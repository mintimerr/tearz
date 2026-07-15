export type SharedVocabCard = {
  front: string;
  back: string;
  pinyin?: string;
};

export type SharedVocabPack = {
  name: string;
  cards: SharedVocabCard[];
};

export type VocabShareCreateRequest = SharedVocabPack;

export type VocabShareCreateResponse = {
  id: string;
  url: string;
};

export type VocabShareGetResponse = SharedVocabPack & {
  id: string;
  createdAt: number;
};

export type VocabShareErrorBody = {
  error: string;
};
