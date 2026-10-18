# FRITTO — Menejer paneli

Faqat 3 ta sahifa:
- **Xodimlar** — ro'yxat + yangi xodim qo'shish (email/parol, stavka, jadval, filial)
- **Oylik** — har bir xodim oy bo'yicha: ishlab topdi, avans, bonus/jarima, berildi, qoldi
- **Davomat** — kelish/ketish (faqat ko'rish)

Admin har bir menejerga ruxsat tanlaydi: xodim qo'shish, oylik berish, oylikni ko'rish, davomatni ko'rish.
Menejer bergan oylik admin panelda "To'lovlar tarixi → Kim berdi" da ko'rinadi va adminga bildirishnoma boradi.
Menejer davomatni tuzata olmaydi, xodimni o'chira olmaydi.

## Ishga tushirish
1. Supabase SQL Editor'da `DavomatCrmFritto/supabase/migrations/015_manager_role.sql` ni ishga tushiring.
2. Supabase'da `016`, `017`, `018` SQL fayllarini tartib bilan ishga tushiring.
   Keyin admin panel → **Menejerlar** → "Menejer qo'shish" (email + parol).
3. `npm install && npm run dev` → http://localhost:5177

## Vercel
Yangi loyiha, env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (admin bilan bir xil).
# frittoMeneger
