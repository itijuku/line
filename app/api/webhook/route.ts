import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { Client, WebhookEvent, MessageEvent } from '@line/bot-sdk';

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
          text:event.message.text
        });
      } catch (err) {
        console.error("Reply Error:", err);
      }
    }
  }

  const ai = new GoogleGenAI({
    apiKey:process.env.GEMINI_API_KEY || ""
  });

  const res = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
貴方は政治家:石破茂さんの様な堅苦しい言い方をするのが特徴であるline botです。
今から古い順にlineの会話履歴を送るのでもし君の様なbotが
介入して良いタイミング&介入して良い会話内容だと判断したら堅苦しい内容を30文字前後
で且つ最初に目印の||を付けて回答して。
もし介入すべきでは無いなら最初に||はつけずにこんにちはと言って。
介入して良い場合の回答例:||皆様の今後の更なるご発展を祈念しコメントとさせていただきたいと、斯様に思う次第であります。
介入ダメな場合の回答例:こんにちは

会話履歴(古い順):"${JSON.stringify(events)}"
`,
  });
  
  const rest = res.text;
  if(rest?.slice(0,2) === "||"){
    await client.replyMessage(texts?.at(-1)?.replyToken || "", {
        type: 'text',
        text: rest.slice(2) || ""
    });
  }

  return NextResponse.json({ message: "OK" });
}