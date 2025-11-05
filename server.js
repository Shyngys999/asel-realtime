import express from "express";
import fetch from "node-fetch";
import WebSocket from "ws";

const app = express();
app.use(express.json({ limit: "50mb" }));

app.post("/webhook", async (req, res) => {
  try {
    const { audio_url } = req.body;
    if (!audio_url) return res.sendStatus(400);

    console.log("🎧 Получено аудио:", audio_url);

    const audio = await fetch(audio_url).then((r) => r.arrayBuffer());

    const ws = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-5-realtime",
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      }
    );

    ws.on("open", () => {
      console.log("🧠 GPT-5 подключен");

      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            voice: "alloy",
            language: "ru",
            allow_interrupt: true,
            barge_in: true,
            system_prompt: `Ты — Асель, бывшая стюардесса с 5-летним опытом работы.
Говори естественно, по-русски и по-казахски.
Отвечай тепло, эмоционально и помогай советами тем, кто хочет стать бортпроводником.`,
          },
        })
      );

      ws.send(audio);
    });

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "partial_audio" && msg.audio) {
          await fetch(
            `https://api.recall.ai/v1/meeting-bots/${process.env.BOT_ID}/speak`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.RECALL_API_KEY}`,
                "Content-Type": "application/octet-stream",
              },
              body: Buffer.from(msg.audio, "base64"),
            }
          );
        }
      } catch (err) {
        console.error("Ошибка при обработке ответа GPT:", err);
      }
    });

    ws.on("error", (err) => console.error("Ошибка WS:", err));

    res.sendStatus(200);
  } catch (err) {
    console.error("Ошибка webhook:", err);
    res.sendStatus(500);
  }
});

app.get("/", (_, res) => res.send("Асель онлайн 🚀"));

app.listen(10000, () => console.log("Асель слушает Zoom 🎧"));

