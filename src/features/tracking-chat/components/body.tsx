"use client";

import { useRef } from "react";
import { MessageBox } from "./message-box";

export function Body() {
  const mockMessages = [
    {
      id: "msg-1",
      content: "Oi! Tudo bem?",
      image: null,
      createdAt: new Date().toISOString(),
      sender: {
        id: "user-1",
        name: "Arthur",
      },
    },
    {
      id: "msg-2",
      content: "Tudo sim! Olha essa foto 👇",
      image: null,
      createdAt: new Date().toISOString(),
      sender: {
        id: "user-1",
        name: "Arthur",
      },
    },
    {
      id: "msg-3",
      content: null,
      image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e",
      createdAt: new Date().toISOString(),
      sender: {
        id: "user-1",
        name: "Arthur",
      },
    },
    {
      id: "msg-3",
      content: null,
      image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e",
      createdAt: new Date().toISOString(),
      sender: {
        id: "user-1",
        name: "Arthur",
      },
    },
    {
      id: "msg-3",
      content: null,
      image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e",
      createdAt: new Date().toISOString(),
      sender: {
        id: "user-1",
        name: "Arthur",
      },
    },
    {
      id: "msg-3",
      content: null,
      image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e",
      createdAt: new Date().toISOString(),
      sender: {
        id: "user-1",
        name: "Arthur",
      },
    },
  ];

  const bottomRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-cols-tracking">
      {mockMessages.map((message) => (
        <MessageBox key={message.id} data={message} />
      ))}
      <div ref={bottomRef} className="pt-24" />
    </div>
  );
}
