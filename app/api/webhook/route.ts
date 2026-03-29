import { NextRequest, NextResponse } from 'next/server';
import { Client, WebhookEvent, MessageEvent } from '@line/bot-sdk';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const events: WebhookEvent[] = body.events;

  // 1. 検証ボタンや空のイベントが来た時のためにチェックを入れる
  if (!events || events.length === 0) {
    return NextResponse.json({ message: "No events" });
  }

  const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  };
  const client = new Client(lineConfig);

  // 全てのイベントをループで処理（検証エラー回避＋複数メッセージ対応）
  for (const event of events) {
    // メッセージイベントかつテキストメッセージの場合のみ
    if (event.type === 'message' && event.message.type === 'text') {
      const replyToken = event.replyToken;
      
      try {
        await client.replyMessage(replyToken, {
          type: 'text',
          text: "hello",
        });
      } catch (err) {
        console.error("Reply Error:", err);
      }
    }
  }

  return NextResponse.json({ message: "OK" });
}