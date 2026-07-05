# Telegram Bot — Civic Complaint Intake (Track 1, Coimbatore)

A citizen messages the bot on Telegram with a complaint (text, voice note, or
photo). The bot forwards it to the backend intake API and replies with a
bilingual (Tamil + English) acknowledgement. This is the live demo "wow": a judge
messages the bot on stage and the complaint appears on the dashboard.

The bot is loosely coupled — it talks to the backend **only over HTTP**
(`INTAKE_API_URL`) and imports no other app module.

## 1. Create a bot and get a token

1. Open Telegram and start a chat with **@BotFather**.
2. Send `/newbot` and follow the prompts (choose a name and a username ending in
   `bot`, e.g. `CbeCivicBot`).
3. BotFather replies with an **HTTP API token** that looks like
   `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
4. **Copy the token.** Never commit it to git.

## 2. Configure environment

Create (or edit) a `.env` file in the `backend/` directory:

```env
TELEGRAM_BOT_TOKEN=123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Optional — defaults to http://localhost:8000/api/intake
INTAKE_API_URL=http://localhost:8000/api/intake
```

> **Never commit `.env`.** Make sure it is listed in `.gitignore`.

## 3. Install dependencies

From the `backend/` directory:

```bash
pip install -r requirements.txt
```

(`python-telegram-bot==21.9`, `httpx`, and `python-dotenv` are already listed.)

## 4. Run the bot

From the `backend/` directory:

```bash
python -m app.telegram_bot.bot
```

The bot uses **long-polling** (no webhook / public URL needed), which is the
simplest option for local development and demos. Leave it running.

For the full end-to-end demo, also start the backend API so intake succeeds:

```bash
uvicorn app.main:app --reload
```

If the intake API is down, the bot still acknowledges the citizen gracefully
(the complaint is reported as queued) so the on-stage experience never breaks.

## 5. Try it

1. Open your bot in Telegram (search its `@username`).
2. Send `/start` → bilingual welcome.
3. Send a text message, a voice note, or a photo.
4. You get a reply like:
   `✅ உங்கள் புகார் பெறப்பட்டது. குறிப்பு எண் #<chat_id>-<n>` /
   `✅ Your complaint has been received. Ref #<chat_id>-<n>`.

## Payload sent to the intake API

Each message POSTs JSON to `INTAKE_API_URL`:

```json
{
  "source": "telegram",
  "chat_id": 123456789,
  "language_hint": "ta",
  "text": "தண்ணீர் வரவில்லை",
  "voice_path": "/tmp/civic_xxxx.ogg",
  "photo_path": null
}
```

`text`, `voice_path`, and `photo_path` are `null` when not applicable. Voice
notes are downloaded as `.ogg` and photos as `.jpg` (largest size) to a temp
file, and the local path is passed to the backend for transcription / vision.
