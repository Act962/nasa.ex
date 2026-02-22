export type Lead = {
  order: string;
  id: string;
  email: string | null;
  name: string;
  profile: string | null;
  statusId: string;
  createdAt: Date;
  phone: string | null;
  responsible: {
    image: string | null;
    name: string;
  } | null;
  leadTags: {
    tag: {
      id: string;
      name: string;
      color: string | null;
      slug: string;
    };
  }[];
};
