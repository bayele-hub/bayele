// Home page photography — one place to swap images.
//
// All four are free under the Unsplash License (commercial use allowed, credit appreciated).
// They are placeholders until licensed shoots of Cameroonian / Ivorian / Gabonese creators and
// brands replace them: change `src` here and every usage updates. Keep the crop params
// (w/h + fit=crop&crop=faces) so the frames stay sharp and light on mobile data.

const U = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&q=72&auto=format&fit=crop&crop=faces`;

export const HOME_PHOTOS = {
  /** Hero — creator in command of the craft: director with cinema camera and slate (Enugu, Nigeria). */
  heroCreator: {
    src: U('photo-1716482554152-0b4d1a4e9c52', 560, 700),
    credit: 'Blessing Olarewaju — unsplash.com/photos/C_aK3lrKDsE',
  },
  /** Hero — brand leadership: executive in an orange blazer. */
  heroBrand: {
    src: U('photo-1563132337-f159f484226c', 520, 650),
    credit: 'Etty Fidele — unsplash.com/photos/AzVexpHvuKY',
  },
  /** How it works — brands: a team reviewing a campaign together. */
  howBrand: {
    src: U('photo-1655720357872-ce227e4164ba', 900, 720),
    credit: 'Iwaria Inc. — unsplash.com/photos/M7ALc3UuX_g',
  },
  /** How it works — creators: a creator filming herself. */
  howCreator: {
    src: U('photo-1756764226194-de7afad3ced6', 900, 720),
    credit: 'Ufoma Ojo — unsplash.com/photos/uxm9m69h7wE',
  },
} as const;
