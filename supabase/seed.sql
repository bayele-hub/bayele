-- ============================================================================
-- Bayele — demo talent seed (NOT a migration; environment data).
-- Team: Bayele Core Platform Engineering · Growth
-- Purpose: populate the public directory with active creators + consultants so the live
--          marketplace isn't an empty shell pre-launch. Idempotent (ON CONFLICT DO NOTHING).
-- Apply:   psql / supabase db reset (auto-runs seed.sql), or the Supabase SQL editor.
-- Notes:   • Demo identities use fixed UUIDs (allowed for SEED data; forbidden in migrations).
--          • auth.users rows are created because public.profiles.id → auth.users(id). Passwords
--            are random; these accounts exist to own directory profiles, not for real login.
--          • All are status='active' so RLS exposes them; handles match ^[a-z0-9_]{3,30}$.
-- ============================================================================

-- 1) auth.users (identity seam). Minimal confirmed email users.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000001','authenticated','authenticated','demo_awa_beauty@bayele.app',    crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000002','authenticated','authenticated','demo_yao_tech@bayele.app',      crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000003','authenticated','authenticated','demo_fatou_mode@bayele.app',    crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000004','authenticated','authenticated','demo_chef_blaise@bayele.app',   crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000005','authenticated','authenticated','demo_aicha_music@bayele.app',   crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000006','authenticated','authenticated','demo_junior_sport@bayele.app',  crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000007','authenticated','authenticated','demo_nadege_wellness@bayele.app',crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000008','authenticated','authenticated','demo_serge_comedy@bayele.app',  crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000001','authenticated','authenticated','demo_marlene_media@bayele.app', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000002','authenticated','authenticated','demo_cyrille_growth@bayele.app',crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000003','authenticated','authenticated','demo_estelle_brand@bayele.app', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}'),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-4000-8000-000000000004','authenticated','authenticated','demo_patrick_campaigns@bayele.app',crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"seed":true}')
ON CONFLICT (id) DO NOTHING;

-- 2) profiles (all active so the public-read RLS exposes them).
INSERT INTO public.profiles (id, handle, display_name, avatar_url, bio, city, country, status) VALUES
  ('a0000000-0000-4000-8000-000000000001','awa_beauty','Awa Ngono','https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=256&q=80','Créatrice beauté & skincare. Tutoriels en français et douala.','Douala','CM','active'),
  ('a0000000-0000-4000-8000-000000000002','yao_tech','Yao Kouassi','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&q=80','Tech reviews, astuces smartphones et bons plans Abidjan.','Abidjan','CI','active'),
  ('a0000000-0000-4000-8000-000000000003','fatou_mode','Fatou Mbeki','https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=256&q=80','Mode & style urbain. Ambassadrice de créateurs gabonais.','Libreville','GA','active'),
  ('a0000000-0000-4000-8000-000000000004','chef_blaise','Blaise Fotso','https://images.unsplash.com/photo-1583394838336-acd977736f90?w=256&q=80','Chef & food creator. Cuisine camerounaise revisitée.','Yaoundé','CM','active'),
  ('a0000000-0000-4000-8000-000000000005','aicha_music','Aicha Traoré','https://images.unsplash.com/photo-1516575334481-f85287c2c82d?w=256&q=80','Chanteuse & créatrice musique. Coupé-décalé et afropop.','Abidjan','CI','active'),
  ('a0000000-0000-4000-8000-000000000006','junior_sport','Junior Ondo','https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=256&q=80','Fitness & sport. Programmes maison pour tous niveaux.','Libreville','GA','active'),
  ('a0000000-0000-4000-8000-000000000007','nadege_wellness','Nadège Kamga','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&q=80','Bien-être, nutrition et santé au quotidien.','Douala','CM','active'),
  ('a0000000-0000-4000-8000-000000000008','serge_comedy','Serge Abega','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&q=80','Humoriste. Sketchs du quotidien camerounais.','Yaoundé','CM','active'),
  ('b0000000-0000-4000-8000-000000000001','marlene_media','Marlène Essomba','https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&q=80','Consultante stratégie média & influence. 8 ans d''expérience.','Douala','CM','active'),
  ('b0000000-0000-4000-8000-000000000002','cyrille_growth','Cyrille Adjovi','https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=256&q=80','Growth & performance marketing pour marques africaines.','Abidjan','CI','active'),
  ('b0000000-0000-4000-8000-000000000003','estelle_brand','Estelle Nguema','https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&q=80','Brand & content strategist. 10 ans, agences et startups.','Libreville','GA','active'),
  ('b0000000-0000-4000-8000-000000000004','patrick_campaigns','Patrick Mballa','https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=256&q=80','Campaign ops & coordination créateurs à grande échelle.','Yaoundé','CM','active')
ON CONFLICT (id) DO NOTHING;

-- 3) roles.
INSERT INTO public.user_roles (user_id, role) VALUES
  ('a0000000-0000-4000-8000-000000000001','creator'),('a0000000-0000-4000-8000-000000000002','creator'),
  ('a0000000-0000-4000-8000-000000000003','creator'),('a0000000-0000-4000-8000-000000000004','creator'),
  ('a0000000-0000-4000-8000-000000000005','creator'),('a0000000-0000-4000-8000-000000000006','creator'),
  ('a0000000-0000-4000-8000-000000000007','creator'),('a0000000-0000-4000-8000-000000000008','creator'),
  ('b0000000-0000-4000-8000-000000000001','consultant'),('b0000000-0000-4000-8000-000000000002','consultant'),
  ('b0000000-0000-4000-8000-000000000003','consultant'),('b0000000-0000-4000-8000-000000000004','consultant')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) creator_profiles (categories drive the directory filter; platforms drive the profile socials).
INSERT INTO public.creator_profiles (user_id, categories, audience_size, rating_avg, platforms) VALUES
  ('a0000000-0000-4000-8000-000000000001', ARRAY['Beauté'],            45000, 4.9, '{"whatsapp":{"url":"https://wa.me/237600000001","followers":12000},"instagram":{"url":"https://instagram.com/awa_beauty","followers":45000},"tiktok":{"url":"https://tiktok.com/@awa_beauty","followers":38000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000002', ARRAY['Tech'],              32000, 4.7, '{"youtube":{"url":"https://youtube.com/@yao_tech","followers":21000},"tiktok":{"url":"https://tiktok.com/@yao_tech","followers":32000},"x":{"url":"https://x.com/yao_tech","followers":9000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000003', ARRAY['Mode'],              28000, 4.8, '{"instagram":{"url":"https://instagram.com/fatou_mode","followers":28000},"tiktok":{"url":"https://tiktok.com/@fatou_mode","followers":19000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000004', ARRAY['Food'],              51000, 4.9, '{"whatsapp":{"url":"https://wa.me/237600000004","followers":15000},"instagram":{"url":"https://instagram.com/chef_blaise","followers":51000},"youtube":{"url":"https://youtube.com/@chef_blaise","followers":33000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000005', ARRAY['Musique'],           67000, 4.8, '{"instagram":{"url":"https://instagram.com/aicha_music","followers":67000},"tiktok":{"url":"https://tiktok.com/@aicha_music","followers":54000},"youtube":{"url":"https://youtube.com/@aicha_music","followers":40000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000006', ARRAY['Sport'],             22000, 4.6, '{"tiktok":{"url":"https://tiktok.com/@junior_sport","followers":22000},"instagram":{"url":"https://instagram.com/junior_sport","followers":14000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000007', ARRAY['Santé & Bien-être'], 38000, 4.9, '{"whatsapp":{"url":"https://wa.me/237600000007","followers":11000},"instagram":{"url":"https://instagram.com/nadege_wellness","followers":38000},"facebook":{"url":"https://facebook.com/nadege.wellness","followers":26000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000008', ARRAY['Humour'],            74000, 4.9, '{"tiktok":{"url":"https://tiktok.com/@serge_comedy","followers":74000},"instagram":{"url":"https://instagram.com/serge_comedy","followers":52000},"facebook":{"url":"https://facebook.com/serge.comedy","followers":61000}}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

-- 5) consultant_profiles.
INSERT INTO public.consultant_profiles (user_id, specialties, agency_access, years_experience) VALUES
  ('b0000000-0000-4000-8000-000000000001', ARRAY['Stratégie média','Influence'],       true,  8),
  ('b0000000-0000-4000-8000-000000000002', ARRAY['Growth','Performance'],              true,  6),
  ('b0000000-0000-4000-8000-000000000003', ARRAY['Brand','Content'],                   false, 10),
  ('b0000000-0000-4000-8000-000000000004', ARRAY['Coordination campagnes','Créateurs'],true,  7)
ON CONFLICT (user_id) DO NOTHING;
