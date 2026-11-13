import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "يجب تسجيل الدخول أولاً." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-6-luna";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "إعدادات الخادم غير مكتملة." }, 500);
  }
  if (!openAiKey) {
    return json({ error: "خدمة المدرب الذكي لم تُفعّل بعد. أضف OPENAI_API_KEY إلى أسرار Supabase Edge Functions." }, 503);
  }

  let payload: { question?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "صيغة الطلب غير صحيحة." }, 400);
  }
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question || question.length > 800) return json({ error: "اكتب سؤالاً من 1 إلى 800 حرف." }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "تعذر التحقق من حسابك." }, 401);
  const userId = authData.user.id;

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("age,sex,height_cm,activity_level,goal,training_experience,available_days,dietary_pattern,preferred_training_times,ai_coach_consent")
    .eq("id", userId)
    .single();
  if (profileError || !profile) return json({ error: "تعذر قراءة ملفك الرياضي." }, 400);
  if (!profile.ai_coach_consent) return json({ error: "يجب الموافقة على مشاركة بيانات التدريب مع خدمة الذكاء الاصطناعي أولاً." }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("ai_coach_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("requested_at", since);
  if (countError) return json({ error: "تعذر التحقق من حد الاستخدام." }, 500);
  if ((count || 0) >= 5) return json({ error: "وصلت إلى الحد اليومي: 5 أسئلة للمدرب الذكي. حاول غداً." }, 429);

  const { error: usageError } = await admin.from("ai_coach_requests").insert({ user_id: userId });
  if (usageError) return json({ error: "تعذر تسجيل طلب المدرب." }, 500);

  const from = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const [logsResult, sessionsResult] = await Promise.all([
    userClient.from("workout_logs")
      .select("exercise_name,sets_data,performed_at")
      .eq("user_id", userId)
      .gte("performed_at", from)
      .order("performed_at", { ascending: false })
      .limit(40),
    userClient.from("workout_sessions")
      .select("session_date,day_title,status")
      .eq("user_id", userId)
      .gte("session_date", from.slice(0, 10))
      .order("session_date", { ascending: false })
      .limit(28),
  ]);
  if (logsResult.error || sessionsResult.error) {
    return json({ error: "تعذر تحميل سجلات التدريب الخاصة بك." }, 500);
  }

  // Do not send health notes, injury descriptions, allergies, email, or body measurements.
  const context = {
    profile: {
      age: profile.age,
      sex: profile.sex,
      height_cm: profile.height_cm,
      activity_level: profile.activity_level,
      goal: profile.goal,
      training_experience: profile.training_experience,
      training_days: profile.available_days,
      preferred_training_times: profile.preferred_training_times,
      dietary_pattern: profile.dietary_pattern,
    },
    workout_logs_last_28_days: logsResult.data || [],
    workout_sessions_last_28_days: sessionsResult.data || [],
  };

  const system = [
    "أنت مدرب لياقة ومقاومة باللغة العربية داخل تطبيق ALI FITNESS PRO.",
    "استخدم فقط بيانات التدريب المرفقة. لا تخترع أوزاناً أو قياسات أو نتائج غير موجودة.",
    "قدّم نصائح عملية قصيرة، وميّز بوضوح بين ما تدعمه السجلات وما هو اقتراح عام.",
    "لا تشخّص الأمراض ولا تصف أدوية ولا تعالج الإصابات. إذا ذكر المستخدم ألماً حاداً أو مستمراً، أوقف اقتراح تحميل العضلة ووجّهه إلى مختص.",
    "لا توصي بمكملات علاجية أو جرعات دوائية. لا تقترح عجز سعرات أو حمية لخسارة الوزن لمن هم دون 18 عاماً.",
    "لا تغيّر الأوزان أو الخطط تلقائياً؛ اعرض التوصية وسببها ليقرر المستخدم.",
    "إذا لم تكفِ البيانات، قل ذلك واطلب تسجيل الوزن والتكرارات وRPE بدلاً من التخمين.",
    "أجب بالعربية الواضحة، بنقاط قصيرة، وبأسلوب مشجع غير مبالغ."
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 650,
      input: [
        { role: "system", content: system },
        { role: "user", content: "بياناتي التدريبية الحالية:\n" + JSON.stringify(context) + "\n\nسؤالي:\n" + question },
      ],
    }),
  });

  if (!response.ok) {
    console.error("OpenAI Responses API error:", response.status);
    return json({ error: "تعذر الحصول على تحليل من المدرب حالياً. حاول لاحقاً." }, 502);
  }

  const result = await response.json();
  const answer = typeof result.output_text === "string" ? result.output_text.trim() : "";
  if (!answer) return json({ error: "لم يصل رد قابل للعرض من المدرب." }, 502);
  return json({ answer, remainingToday: Math.max(0, 4 - (count || 0)) });
});
