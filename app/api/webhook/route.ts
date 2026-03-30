import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { Client, WebhookEvent, MessageEvent } from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';
import { timeStamp } from 'console';


export async function POST(req: NextRequest) {
  const body = await req.json();
  const events: WebhookEvent[] = body.events;

  if (!events || events.length === 0) {
    return NextResponse.json({ message: "No events" });
  }

  const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  };
  const client = new Client(lineConfig);

  const texts = [];
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const replyToken = event.replyToken;
      
      try {
        texts.push({
          replyToken,
          userId:event.source.userId,
          text:event.message.text,
          timeStamp:event.timestamp,
          chatId:event.source.type === 'group' ? 
            event.source.groupId :
            event.source.type === 'room'  ? 
            event.source.roomId :
            event.source.userId
        });
      } catch (err) {
        console.error("Reply Error:", err);
      }
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: history, error: fetchError } = await supabase
    .from('messages')
    .select('user_id, content, created_at')
    .eq('chat_id', texts[0].chatId)
    .order('created_at', { ascending: false })
    .limit(10);

  const yn = false;

  if (history && (history as any[]).length > 0) {
    const lastCreatedAt = (history as any[])[0].created_at;
    
    const lastUnix = new Date(lastCreatedAt).getTime();
    const nowUnix = Date.now();

    if (nowUnix - lastUnix < 10000) {
      console.log(`直近の議論から ${nowUnix - lastUnix}ms。拙速な回答は避けるべきであります。`);
      return NextResponse.json({ message: "Cooldown active" });
    }
  }

  const ai = new GoogleGenAI({
    apiKey:process.env.GEMINI_API_KEY || ""
  });

  const ms = ["gemini-2.5-flash-lite"];
  const useModel = ms[Math.floor(Math.random() * ms.length)];
  console.log(events[0].source.type)
  const res = await ai.models.generateContent({
      model: useModel,
      contents: `
貴方は政治家:石破茂さんの様な堅苦しい言い方をするのが特徴であるline botです。
今から古い順にlineの会話履歴を送るのでもし君の様なbotが
介入して良いタイミング&介入して良い会話内容だと判断したら堅苦しい内容を30文字前後
で且つ最初に目印の||を付けて回答して。
もし介入すべきでは無いなら最初に||はつけずにこんにちはと言って。
介入して良い場合の回答例:||皆様の今後の更なるご発展を祈念しコメントとさせていただきたいと、斯様に思う次第であります。
介入ダメな場合の回答例:こんにちは
尚回答を考えるのに回答例の文言を参考にしたり真似たりはしなくてよい。
${events[0].source.type === "user" ? "尚これはlineグループではなく友達との会話だから基本的に介入して":""}

過去の会話履歴(古い順):${JSON.stringify(history?.reverse())}
新しい会話履歴(古い順):"${JSON.stringify(events)}"
`,
  });
  
  const rest = res.text;
  if(rest?.slice(0,2) === "||"){
    await client.replyMessage(texts?.at(-1)?.replyToken || "", {
        type: 'text',
        text: rest.slice(2) || ""
    });
  }
  const foradd = texts.map(d=>({
    user_id:d.userId,
    content:d.text,
    chat_id:d.chatId
  }))

  const { data, error } = await supabase
    .from('messages') // テーブル名
    .insert(foradd)
    .select(); // 挿入したデータを結果として受け取る

  if (error) {
    console.error('保存エラー:', error.message);
  }

  return NextResponse.json({ message: "OK" });
}