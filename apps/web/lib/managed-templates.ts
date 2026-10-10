// Industry templates (design §9.1) — TEXT ONLY: no prices, no quantities, no places, no brand, city,
// country or deadline (K1 + lever #5: « no prices until real data exists »). Shared by the admin brief
// editor and the brand self-serve form. Categories use the board values (R8 adds ONG / Immobilier /
// Hôtellerie / Finance / Fintech).

import type { Locale } from '@/i18n/config';
import type { DeliverableType, RightsPresetKey } from '@/lib/managed-listing';

type Text = { fr: string; en: string };

export interface ManagedTemplate {
  key: string;
  label: Text;
  /** campaigns.category value (CAMPAIGN_CATEGORIES[].fr). */
  category: string;
  service: Text;
  type: DeliverableType;
  platforms: string[];
  deliverables: Text;
  requirements: Text;
  equipment: Text | null;
  rights: RightsPresetKey;
  /** Internal compliance hint (admin only, never public). */
  hint: Text | null;
}

export const MANAGED_TEMPLATES: readonly ManagedTemplate[] = [
  {
    key: 'restaurant',
    label: { fr: 'Restaurant', en: 'Restaurant' },
    category: 'Food',
    service: { fr: 'Pack contenu food pour un restaurant', en: 'Food content pack for a restaurant' },
    type: 'short_video',
    platforms: ['instagram', 'tiktok', 'facebook'],
    deliverables: {
      fr: 'Photos du menu et du lieu, retouchées\u202f; vidéos verticales courtes (plats, ambiance, équipe), sous-titrées.',
      en: 'Retouched photos of the menu and venue; short vertical videos (dishes, atmosphere, team) with subtitles.',
    },
    requirements: { fr: 'Photographe ou vidéaste food, portfolio de plats ou de lieux', en: 'Food photographer or videographer with a portfolio of dishes or venues' },
    equipment: { fr: 'Smartphone récent ou appareil photo\u202f; lumière d’appoint', en: 'Recent smartphone or camera; fill light' },
    rights: 'organic_6m',
    hint: { fr: 'Packs mensuels\u00a0: vérifier le seuil.', en: 'Monthly packs: check the floor.' },
  },
  {
    key: 'mode',
    label: { fr: 'Mode', en: 'Fashion' },
    category: 'Mode',
    service: { fr: 'Campagne Reels et TikTok pour une marque de mode', en: 'Reels and TikTok campaign for a fashion brand' },
    type: 'short_video',
    platforms: ['instagram', 'tiktok'],
    deliverables: {
      fr: 'Concepts créatifs, tournage et montage de vidéos verticales portant les pièces de la marque.',
      en: "Creative concepts, shooting and editing of vertical videos featuring the brand's pieces.",
    },
    requirements: { fr: 'Créateur mode ou lifestyle, à l’aise face caméra, sens du stylisme', en: 'Fashion or lifestyle creator, comfortable on camera, with a styling eye' },
    equipment: null,
    rights: 'organic_6m',
    hint: { fr: 'Photo + vidéo\u00a0: 1 ou 2 places à confirmer.', en: 'Photo + video: 1 or 2 spots to confirm.' },
  },
  {
    key: 'beaute',
    label: { fr: 'Beauté', en: 'Beauty' },
    category: 'Beauté',
    service: { fr: 'Vidéos UGC pour une marque beauté', en: 'UGC videos for a beauty brand' },
    type: 'ugc_video',
    platforms: ['tiktok', 'instagram'],
    deliverables: { fr: 'Vidéos authentiques\u00a0: démonstration du produit, voix off ou face caméra.', en: 'Authentic videos: product demo, voice-over or on camera.' },
    requirements: { fr: 'Créateur beauté, démonstration produit naturelle face caméra', en: 'Beauty creator, natural on-camera product demos' },
    equipment: null,
    rights: 'organic_6m',
    hint: { fr: 'Pas d’allégation santé non justifiée\u202f; avant/après sans retouche trompeuse.', en: 'No unsubstantiated health claims; no misleading before/after edits.' },
  },
  {
    key: 'immobilier',
    label: { fr: 'Immobilier', en: 'Real estate' },
    category: 'Immobilier',
    service: { fr: 'Visites vidéo de biens immobiliers', en: 'Video tours of properties' },
    type: 'short_video',
    platforms: ['instagram', 'tiktok', 'facebook', 'youtube'],
    deliverables: { fr: 'Tournage sur place, montage, sous-titres, formats verticaux.', en: 'On-site shooting, editing, subtitles, vertical formats.' },
    requirements: { fr: 'Vidéaste immobilier ou lifestyle, plans stables, montage soigné', en: 'Real-estate or lifestyle videographer, steady shots, clean editing' },
    equipment: { fr: 'Stabilisateur conseillé', en: 'Gimbal recommended' },
    rights: 'organic_6m',
    hint: { fr: 'Allégations (prix, surface, rendement) à justifier par la marque.', en: 'Claims (price, size, yield) must be substantiated by the brand.' },
  },
  {
    key: 'hotel',
    label: { fr: 'Hôtel', en: 'Hotel' },
    category: 'Hôtellerie',
    service: { fr: 'Shooting photo et vidéo pour un hôtel', en: 'Photo and video shoot for a hotel' },
    type: 'shoot_day',
    platforms: ['instagram', 'facebook', 'tiktok'],
    deliverables: { fr: 'Chambres, services, restauration\u202f; photos retouchées et vidéos verticales courtes.', en: 'Rooms, services, dining; retouched photos and short vertical videos.' },
    requirements: { fr: 'Photographe ou vidéaste hôtellerie / voyage', en: 'Hospitality or travel photographer / videographer' },
    equipment: { fr: 'Appareil photo ou smartphone haut de gamme\u202f; éclairage d’appoint', en: 'High-end camera or smartphone; fill light' },
    rights: 'organic_6m',
    hint: { fr: 'Consentement écrit des clients filmés\u202f; vérifier le seuil.', en: 'Written consent from filmed guests; check the floor.' },
  },
  {
    key: 'fintech',
    label: { fr: 'Fintech', en: 'Fintech' },
    category: 'Finance / Fintech',
    service: { fr: 'Vidéos pédagogiques pour un service financier', en: 'Explainer videos for a financial service' },
    type: 'short_video',
    platforms: ['tiktok', 'facebook', 'instagram', 'youtube'],
    deliverables: { fr: 'Expliquer les services en langage simple, face caméra, avec sous-titres.', en: 'Explain the services in plain language, on camera, with subtitles.' },
    requirements: { fr: 'Présentateur à l’aise avec la finance, langage simple', en: 'Presenter comfortable with finance, plain language' },
    equipment: null,
    rights: 'organic_6m',
    hint: { fr: 'Allégations financières à justifier\u202f; aucune promesse de gain.', en: 'Financial claims must be substantiated; no promise of returns.' },
  },
  {
    key: 'tech',
    label: { fr: 'Tech / App', en: 'Tech / App' },
    category: 'Tech',
    service: { fr: 'Tutoriels vidéo pour une application', en: 'Video tutorials for an app' },
    type: 'short_video',
    platforms: ['tiktok', 'instagram', 'youtube'],
    deliverables: { fr: 'Tutoriels courts\u00a0: installation, fonctions clés, cas d’usage.', en: 'Short tutorials: setup, key features, use cases.' },
    requirements: { fr: 'Créateur tech ou tutoriel, capture d’écran et face caméra', en: 'Tech or tutorial creator, screen recording and on camera' },
    equipment: {
      fr: 'Smartphone avec capture d’écran\u202f; logiciel d’animation si vidéo animée',
      en: 'Smartphone with screen recording; animation software for animated videos',
    },
    rights: 'organic_6m',
    hint: { fr: 'Vidéo animée = type «\u00a0animation\u00a0»\u00a0: vérifier le seuil.', en: 'Animated video = "animation" type: check the floor.' },
  },
  {
    key: 'education',
    label: { fr: 'Éducation', en: 'Education' },
    category: 'Éducation',
    service: { fr: 'Vidéos de promotion de formations', en: 'Promo videos for courses' },
    type: 'short_video',
    platforms: ['facebook', 'instagram', 'tiktok', 'youtube'],
    deliverables: { fr: 'Présenter les formations, leurs débouchés et l’inscription.', en: 'Present the courses, career outcomes and how to enrol.' },
    requirements: { fr: 'Présentateur ou créateur éducation, diction claire', en: 'Presenter or education creator with clear delivery' },
    equipment: null,
    rights: 'organic_6m',
    hint: null,
  },
  {
    key: 'ong',
    label: { fr: 'ONG', en: 'NGO' },
    category: 'ONG / Impact social',
    service: { fr: 'Récits d’impact en vidéo pour une ONG', en: 'Impact stories on video for an NGO' },
    type: 'long_video',
    platforms: ['facebook', 'youtube', 'instagram', 'linkedin'],
    deliverables: { fr: 'Interviews, tournage sur le terrain, narration et montage.', en: 'Interviews, field shooting, narration and editing.' },
    requirements: { fr: 'Créateur documentaire\u00a0: interviews, narration, montage', en: 'Documentary creator: interviews, narration, editing' },
    equipment: { fr: 'Micro-cravate\u202f; trépied', en: 'Lavalier mic; tripod' },
    rights: 'organic_6m',
    hint: { fr: 'Consentement écrit de chaque personne filmée\u202f; mineurs\u00a0: accord des parents.', en: 'Written consent from everyone filmed; minors: parental consent.' },
  },
  {
    key: 'agro',
    label: { fr: 'Agro', en: 'Agribusiness' },
    category: 'Food',
    service: { fr: 'Vidéos «\u00a0de la ferme au marché\u00a0»', en: 'Farm-to-market videos' },
    type: 'short_video',
    platforms: ['facebook', 'tiktok', 'instagram', 'youtube'],
    deliverables: { fr: 'Opérations, produits et production, du champ au point de vente.', en: 'Operations, products and production, from field to market.' },
    requirements: { fr: 'Vidéaste à l’aise en extérieur et sur site de production', en: 'Videographer comfortable outdoors and on production sites' },
    equipment: null,
    rights: 'organic_6m',
    hint: null,
  },
  {
    key: 'ecommerce',
    label: { fr: 'E-commerce', en: 'E-commerce' },
    category: 'Business',
    service: { fr: 'Démonstrations produit pour une boutique en ligne', en: 'Product demos for an online shop' },
    type: 'short_video',
    platforms: ['tiktok', 'instagram', 'facebook'],
    deliverables: { fr: 'Vidéos de démonstration utilisables sur le site et les réseaux.', en: 'Demo videos usable on the website and social channels.' },
    requirements: { fr: 'Créateur démo produit ou UGC', en: 'Product-demo or UGC creator' },
    equipment: null,
    rights: 'organic_web',
    hint: { fr: 'Publicité payante à chiffrer avant le bon de commande.', en: 'Price paid ads before the order form.' },
  },
  {
    key: 'b2b',
    label: { fr: 'B2B / LinkedIn', en: 'B2B / LinkedIn' },
    category: 'Business',
    service: { fr: 'Contenu LinkedIn d’expertise', en: 'LinkedIn thought-leadership content' },
    type: 'post',
    platforms: ['linkedin'],
    deliverables: { fr: 'Posts d’expertise rédigés et vidéos professionnelles tournées avec les experts.', en: 'Written expertise posts and professional videos shot with the experts.' },
    requirements: { fr: 'Créateur LinkedIn ou B2B, à l’aise avec des experts en entreprise', en: 'LinkedIn or B2B creator, comfortable working with company experts' },
    equipment: null,
    rights: 'organic_6m',
    hint: { fr: 'Film fondateur\u00a0: type «\u00a0long_video\u00a0».', en: 'Founder film: "long_video" type.' },
  },
  {
    key: 'ugc',
    label: { fr: 'UGC multi-créateurs', en: 'Multi-creator UGC' },
    category: 'Business',
    service: { fr: 'Campagne UGC multi-créateurs', en: 'Multi-creator UGC campaign' },
    type: 'ugc_video',
    platforms: ['tiktok', 'instagram', 'whatsapp'],
    deliverables: { fr: 'Par créateur\u00a0: avis, témoignage, problème / solution, présentation d’offre.', en: 'Per creator: review, testimonial, problem / solution, offer showcase.' },
    requirements: { fr: 'Micro-créateurs authentiques, communauté locale', en: 'Authentic micro-creators with a local community' },
    equipment: null,
    rights: 'organic_6m',
    hint: {
      fr: 'Une campagne, N places, rémunération par place\u202f; pas de récurrent (1 mois, renouvelé par une nouvelle commande).',
      en: 'One campaign, N spots, pay per spot; no recurring work (1 month, renewed by a new order).',
    },
  },
];

export function findTemplate(key: string | null | undefined): ManagedTemplate | null {
  return MANAGED_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function templateText(t: Text | null, locale: Locale): string {
  return t ? t[locale] : '';
}
