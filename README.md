# [Project Name] — Cross-Platform Asymmetric Survival Game

> ⚡ **Built in about 7 hours for Cursor Codechella Hackathon @Victoria,BC

An asymmetric multiplayer experience that bridges a **React + TypeScript** web application and a live **3D Roblox** environment in real time. Web players interact with the game state via a browser dashboard powered by **Convex**, triggering live environmental events and state changes inside active Roblox servers.

## 🎥 Live Cross-Platform Demo
*(Side-by-side view: React Web Client on the left, live Roblox Server on the right)*

https://github.com/user-attachments/assets/fb01bd99-d01f-4761-90fc-18e02d6fbffa

## 🏗️ System Architecture

Because Roblox operates within a closed engine ecosystem without native WebSockets for external web clients, this project uses **Convex** as a central real-time state broker between the browser and the game server.

```text
+-------------------+        WebSockets (Reactive)        +--------------------+
|  React Web Client | <=================================> |   Convex Backend   |
|  (Vite + TS App)  |     Mutations & Live Queries        | (State & Round DB) |
+-------------------+                                     +--------------------+
                                                                    ^
                                                                    |
                                                           HTTP Polling Loops &
                                                           REST API Endpoints
                                                                    |
                                                                    v
                                                          +--------------------+
                                                          | Roblox Game Server |
                                                          |  (Luau Async Loop) |
                                                          +--------------------+
```

### Data Flow
1. **Web Action:** A user on the React frontend triggers an action or state update, firing a Convex mutation.
2. **State Persistence:** Convex validates and updates the global game round state in real time.
3. **Server Synchronization:** The Roblox server runs an asynchronous HTTP polling loop via `HttpService`, fetching state deltas from Convex HTTP actions and broadcasting updates to 3D clients via `RemoteEvents`.

---

## ⚙️ Key Engineering Challenges

* **Cross-Platform Round Synchronization:** Maintained a single source of truth for game timers, player statuses, and active events across both web and 3D clients to prevent state drift during rapid hackathon iteration.
* **Non-Blocking Asynchronous Polling:** Engineered continuous HTTP request loops in Luau using asynchronous task scheduling (`task.spawn` / `pcall` wrappers) so network latency or dropped packets never freeze the main 3D physics and gameplay thread.
* **Decoupled Modular Architecture:** Separated external network polling logic from core Roblox gameplay mechanics, allowing game rounds to recover gracefully if an HTTP request times out.

---

## 📂 Repository Structure

To make the Roblox server architecture easy to inspect without opening Roblox Studio, all core Luau scripts are included directly alongside the web application:

```text
├── .luau files/                  # Roblox Luau server and client scripts
├── convex/                       # Convex backend schema, queries, mutations & HTTP actions
├── public/                       # Static web assets
├── src/                          # React + TypeScript frontend components and hooks
├── index.html                    # Web app entry point
├── package.json                  # Project dependencies and scripts
└── vite.config.ts                # Vite bundler configuration
```

---

## 🛠️ Tech Stack

* **Web Frontend:** React, TypeScript, Vite
* **Backend & Real-Time Database:** Convex (Queries, Mutations, HTTP Actions)
* **Game Engine & Server Scripting:** Roblox Studio, Luau (`HttpService`, `RemoteEvents`, `ModuleScripts`)

---

## 🚀 Running the Web Client Locally

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the Convex dev deployment and Vite development server:
   ```bash
   npx convex dev
   npm run dev
   ```
