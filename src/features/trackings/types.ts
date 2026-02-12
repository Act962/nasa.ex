export type Lead = {
  order: string;
  id: string;
  email: string | null;
  name: string;
  statusId: string;
  createdAt: Date;
  phone: string | null;
  responsible: {
    image: string | null;
    name: string;
  } | null;
};
