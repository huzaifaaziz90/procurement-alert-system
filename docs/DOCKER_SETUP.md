# 🐳 Docker Setup Guide

Docker runs n8n in a self-contained environment on your computer.
You do not need to install Node.js, configure servers, or touch any
system settings. Install Docker, run one command, done.

---

## What is Docker?

Think of Docker as a mini computer inside your computer. It runs n8n
in its own isolated box — completely separate from the rest of your
system. If something goes wrong, you just delete the box and start again.
Your actual computer is never affected.

```
Your Computer
└── Docker (the box maker)
    └── n8n container (the box)
        └── n8n app (runs inside the box)
```

---

## Step 1 — Install Docker Desktop

Docker Desktop is a free application. It includes everything you need.

### Windows

1. Go to **https://www.docker.com/products/docker-desktop**
2. Click **Download for Windows**
3. Run the installer
4. When asked about WSL 2, click **Install** — this is required on Windows
5. Restart your computer when prompted
6. After restart, open Docker Desktop from the Start menu
7. Wait for the whale icon to appear in your taskbar (bottom right)
   — when it is steady (not animated), Docker is ready

**System requirements for Windows:**
- Windows 10 (64-bit) version 1903 or later
- Windows 11 (any version)
- Virtualisation must be enabled in BIOS
- 4GB RAM minimum (8GB recommended)

> If you see "Virtualisation support not detected" — go to your BIOS
> settings and enable Intel VT-x (Intel CPUs) or AMD-V (AMD CPUs).
> The key to enter BIOS is usually F2, F10, Del, or Esc at startup —
> it depends on your computer brand:
> - Dell: F2
> - HP: F10 or Esc
> - Lenovo: F2 or Fn+F2
> - Asus: F2 or Del
> - Acer: F2 or Del

### Mac

1. Go to **https://www.docker.com/products/docker-desktop**
2. Choose **Download for Mac** — pick Apple Silicon (M1/M2/M3) or
   Intel depending on your Mac
3. Open the downloaded .dmg file and drag Docker to Applications
4. Open Docker from Applications
5. Wait for the whale icon in the menu bar to stop animating

### Linux

Follow the official guide for your distribution:
**https://docs.docker.com/engine/install/**

---

## Step 2 — Verify Docker is working

Open a terminal (Command Prompt or PowerShell on Windows, Terminal on
Mac/Linux) and run:

```bash
docker --version
```

You should see something like `Docker version 26.x.x`.

Run a quick test:

```bash
docker run hello-world
```

If it prints "Hello from Docker!" — Docker is fully working.

---

## Step 3 — Create a folder for your data

This folder stores all your n8n workflows, credentials, and settings.
Even if you uninstall and reinstall n8n, your data stays safe here.

**Windows (PowerShell):**
```powershell
mkdir $HOME\.n8n
mkdir $HOME\procurement-alerts
```

**Mac / Linux:**
```bash
mkdir -p ~/.n8n
mkdir -p ~/procurement-alerts
```

Copy your Excel file into the `procurement-alerts` folder.

---

## Step 4 — Run n8n

Copy and paste this entire command into your terminal. Run it once —
you never need to run it again after this.

**Windows (PowerShell):**
```powershell
docker run -d --restart unless-stopped --name n8n -p 5678:5678 -v $HOME/.n8n:/home/node/.n8n -v $HOME/procurement-alerts:/data/procurement -e N8N_RESTRICT_FILE_ACCESS_TO="/data/procurement" docker.n8n.io/n8nio/n8n
```

**Mac / Linux:**
```bash
docker run -d --restart unless-stopped --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n -v ~/procurement-alerts:/data/procurement -e N8N_RESTRICT_FILE_ACCESS_TO="/data/procurement" docker.n8n.io/n8nio/n8n
```

What each part means:

| Part | What it does |
|---|---|
| `-d` | Runs in the background (detached) |
| `--restart unless-stopped` | Auto-starts when your computer reboots |
| `--name n8n` | Names the container so you can refer to it |
| `-p 5678:5678` | Opens port 5678 so you can access n8n in your browser |
| `-v $HOME/.n8n:/home/node/.n8n` | Saves your n8n data to your computer |
| `-v $HOME/procurement-alerts:/data/procurement` | Gives n8n access to your data folder |
| `-e N8N_RESTRICT_FILE_ACCESS_TO=...` | Tells n8n it is allowed to read that folder |

The first time you run this, Docker downloads n8n (about 500MB).
You will see it pulling layers — just wait. When you see a long ID
printed, it worked.

---

## Step 5 — Open n8n

Open your browser and go to:

```
http://localhost:5678
```

You will see the n8n setup screen. Create a local account:
- Enter any email address (this is just for local login — no account created anywhere)
- Set a password
- Click Get Started

You are now inside n8n.

---

## Daily Use

You do not need to do anything daily. n8n runs automatically in the
background and restarts when your computer reboots.

**Useful commands:**

```bash
# Check if n8n is running
docker ps

# Stop n8n
docker stop n8n

# Start n8n again
docker start n8n

# See what n8n is doing (logs)
docker logs n8n

# See logs live (Ctrl+C to stop)
docker logs -f n8n
```

---

## Updating n8n

To update n8n to the latest version:

```bash
docker stop n8n
docker rm n8n
docker pull docker.n8n.io/n8nio/n8n
```

Then run the same `docker run` command from Step 4 again.
Your data and workflows are safe — they live in your `.n8n` folder,
not inside the container.

---

## Troubleshooting

**"The container name /n8n is already in use"**

The container already exists. Remove it first:
```bash
docker rm -f n8n
```
Then re-run the docker run command from Step 4.

**"Cannot connect to Docker daemon"**

Docker Desktop is not running. Open it from your applications/Start menu
and wait for the whale icon to become steady.

**"Access to the file is not allowed" in n8n**

Make sure you included the `-e N8N_RESTRICT_FILE_ACCESS_TO` part in
your docker run command. Remove and recreate the container with the
full command from Step 4.

**n8n is slow or unresponsive**

Docker may not have enough memory allocated. Open Docker Desktop →
Settings → Resources → increase Memory to at least 2GB.

---

## Further Reading

- Docker Desktop docs: https://docs.docker.com/desktop/
- n8n self-hosting docs: https://docs.n8n.io/hosting/
- n8n community forum: https://community.n8n.io/
