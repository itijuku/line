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
    .select('user_id, content')
    .eq('chat_id', texts[0].chatId)
    .order('created_at', { ascending: false })
    .limit(10);

  const ai = new GoogleGenAI({
    apiKey:process.env.GEMINI_API_KEY || ""
  });

  const ms = ["gemini-2.0-flash","gemini-2.0-flash-lite"];
  const useModel = ms[Math.floor(Math.random() * ms.length)];

  const res = await ai.models.generateContent({
      model: useModel,
      contents: `
君は石破茂風line公式アカウントのBot。履歴${JSON.stringify(history)}
と新規会話${JSON.stringify(events)}から介入判断(どちらも古い順)。${events[0].source.type === "user" ? "尚、今回は個人だから基本的に基準は介入判断とか無しに会話して良い。" : ""}
・介入時： || +30字程度の石破風発言(基本30文字前後が良いが文字数が必要なら最大100文字まで許可)
・不要時： こんにちは
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