import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { Client, WebhookEvent, TextMessage, MessageEvent, TextEventMessage } from '@line/bot-sdk';

export async function POST(req:NextRequest) {
  const body = await req.json();
  const events: WebhookEvent[] = body.events;
  const texts = events
    .filter((d): d is MessageEvent => d.type === "message")
    .filter((d): d is MessageEvent & { message: TextEventMessage } => d.message.type === "text")
    .map(d => ({
      userId: d.source.userId || "",
      timeStamp: d.timestamp,
      text: d.message.text,
      replyToken:d.replyToken
  }));

  const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  };
  const client = new Client(lineConfig);

  // const ai = new GoogleGenAI({});

  // const res = await ai.models.generateContent({
  //     model: "gemini-3-flash-preview",
  //     contents: "こんにちは",
  // });

    // res.text
  await client.replyMessage(texts[0].replyToken, {
    type: 'text',
    text: "hello",
  });

  return NextResponse.json({ message: "OK" });
}