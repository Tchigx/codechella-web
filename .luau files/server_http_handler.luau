local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local Debris = game:GetService("Debris")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- 1. ENDPOINT FIXED TO /sync
local ENDPOINT = "https://dashing-wren-281.convex.site/sync"
local CELL_SIZE, GRID = 16, 8
local ORIGIN = Vector3.new(-(GRID * CELL_SIZE)/2, 0, -(GRID * CELL_SIZE)/2)

local cursor = nil          -- nil on boot = "from now"

-- round state, refreshed from every tick response
local roundStatus    = "idle"
-- 2. CHANGED TO DEADLINE TO PREVENT CLOCK DRIFT
local roundDeadline  = 0     -- os.clock() value when the round ends
local roundIntensity = 0

-- batched up to the server on the next tick
local pendingHits  = 0
local pendingDeath = false

local function cellToWorld(cx, cz)
	return ORIGIN + Vector3.new(cx * CELL_SIZE + CELL_SIZE/2, 0, cz * CELL_SIZE + CELL_SIZE/2)
end

-- Only real players count toward the web team's score. Zombies have
-- Humanoids too, and a boulder flattening one is not a point scored.
local function registerHit(hum)
	local plr = Players:GetPlayerFromCharacter(hum.Parent)
	if not plr then return end
	pendingHits += 1
	-- REMOVED instant death trigger from here!
end

-- Telegraph shortens as the round runs down: 0.8s of warning at the
-- start, 0.35s in the final seconds. This is what makes the end panic.
local function telegraphTime()
	return 0.8 - (roundIntensity * 0.45)
end

local function makeMarker(pos, color, neon)
	local marker = Instance.new("Part")
	marker.Size = Vector3.new(CELL_SIZE - 1, 0.3, CELL_SIZE - 1)
	marker.Position = pos + Vector3.new(0, 1.2, 0)
	marker.Color = color
	if neon then marker.Material = Enum.Material.Neon end
	marker.Transparency = 0.4
	marker.Anchored, marker.CanCollide = true, false
	marker.Parent = workspace
	return marker
end

local function getPositions()
	local out = {}
	for _, plr in Players:GetPlayers() do
		local char = plr.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		if root then
			table.insert(out, {
				userId = tostring(plr.UserId),
				x = root.Position.X,
				y = root.Position.Y,
				z = root.Position.Z,
			})
		end
	end
	return out
end

--------------------------------------------------------------------
-- Hazards
--------------------------------------------------------------------
local handlers = {}

handlers.boulder = function(cmd)
	local pos = cellToWorld(cmd.x, cmd.z)
	local marker = makeMarker(pos, Color3.new(1, 0, 0.0156863), false)

	task.delay(telegraphTime(), function()
		marker:Destroy()

		ReplicatedStorage.ShakeCam:FireAllClients()
		local b = game.ServerStorage.Abilities.Soul:Clone()
		b.Position = pos + Vector3.new(0, 90, 0)
		b.Parent = workspace.Dump
		b:SetNetworkOwner(nil)


		local hit = {}
		local conn
		conn = b.Touched:Connect(function(other)
			local hum = other.Parent and other.Parent:FindFirstChildOfClass("Humanoid")
			if not hum or hit[hum] then return end
			if b.AssemblyLinearVelocity.Magnitude < 40 then return end

			hit[hum] = true
			hum.Health -=15
			registerHit(hum)
		end)

		task.delay(8, function()
			if conn then conn:Disconnect() end
			b:Destroy()
		end)
	end)
end

handlers.misc = function(cmd)
	local pos = cellToWorld(cmd.x, cmd.z)
	local marker = makeMarker(pos, Color3.new(0.0431373, 1, 0.0745098), false)

	task.delay(telegraphTime(), function()
		marker:Destroy()

		ReplicatedStorage.ShakeCam:FireAllClients()
		local b = game.ServerStorage.Abilities.Misc:Clone()
		b.Position = pos + Vector3.new(0, 5, 0)
		b.Parent = workspace.Dump

		local hit = {}
		local conn
		conn = b.Touched:Connect(function(other)
			local hum = other.Parent and other.Parent:FindFirstChildOfClass("Humanoid")
			if not hum or hit[hum] then return end

			hit[hum] = true
			hum.Health -= 45
			registerHit(hum)
		end)

		task.spawn(function()
			for _ = 1, 4 do
				task.wait(1)
				if not b.Parent then return end
				for _, v in b.EffectsAttach:GetChildren() do
					v:Emit(v:GetAttribute("EmitCount"))
				end
			end
		end)

		task.delay(6, function()
			if conn then conn:Disconnect() end
			b:Destroy()
		end)
	end)
end

handlers.zombies = function(cmd)
	local pos = cellToWorld(cmd.x, cmd.z)
	local marker = makeMarker(pos, Color3.new(1, 0.0431373, 0.0745098), true)

	-- more of them as the round gets desperate: 1 early, up to 3 late
	local count = 1 + math.floor(roundIntensity * 2)

	task.delay(telegraphTime(), function()
		marker:Destroy()
		for i = 1, count do
			local zombie = ReplicatedStorage["Drooling Zombie"]:Clone()
			zombie.Parent = workspace.Zombies
			local spread = (i - 1) * 4
			zombie:PivotTo(CFrame.new(pos) + Vector3.new(spread, 4, 0))
		end
	end)
end

handlers.shards = function(cmd)
	local pos = cellToWorld(cmd.x, cmd.z)
	local marker = makeMarker(pos, Color3.new(0.2, 0.788235, 1), true)

	task.delay(telegraphTime() * 0.6, function()
		marker:Destroy()

		local strike = game.ServerStorage.Abilities.Crystals:Clone()
		strike.Parent = workspace.Dump
		strike:PivotTo(CFrame.new(pos.X, 1, pos.Z))

		local tween
		for _, v in strike:GetChildren() do
			if v.Name == "Crystal" then
				tween = TweenService:Create(
					v,
					TweenInfo.new(0.3, Enum.EasingStyle.Linear, Enum.EasingDirection.In),
					{ Size = v.Size + Vector3.new(0, 15, 0) }
				)
				tween:Play()
			end
		end

		Debris:AddItem(strike, 0.7)
		if not tween then return end

		tween.Completed:Connect(function()
			ReplicatedStorage.ShakeCam:FireAllClients()
			for _, plr in Players:GetPlayers() do
				local char = plr.Character
				local root = char and char:FindFirstChild("HumanoidRootPart")
				local hum  = char and char:FindFirstChildOfClass("Humanoid")
				if root and hum and hum.Health > 0 then
					local d = (Vector3.new(root.Position.X, 0, root.Position.Z)
						- Vector3.new(pos.X, 0, pos.Z)).Magnitude
					if d < CELL_SIZE / 2 then
						hum:TakeDamage(45)
						registerHit(hum)
					end
				end
			end
		end)
	end)
end

--------------------------------------------------------------------
-- 3. Local countdown: absolute deadline tracking so it never drifts
--------------------------------------------------------------------
task.spawn(function()
	while true do
		task.wait(0.1)
		local remain = 0
		if roundStatus == "live" then
			remain = math.max(0, roundDeadline - os.clock())
		end
		ReplicatedStorage:SetAttribute("RoundRemaining", math.ceil(remain))
		ReplicatedStorage:SetAttribute("RoundStatus", roundStatus)
	end
end)

--------------------------------------------------------------------
-- Tick
--------------------------------------------------------------------
while true do
	-- NEW: Count how many players are currently alive before sending tick
	local aliveCount = 0
	local totalPlayers = #Players:GetPlayers()

	for _, plr in Players:GetPlayers() do
		local char = plr.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if hum and hum.Health > 0 then
			aliveCount += 1
		end
	end

	-- If a round is actively playing, players exist, and 0 are alive... Web team wins!
	if roundStatus == "live" and totalPlayers > 0 and aliveCount == 0 then
		pendingDeath = true
	end

	-- clear BEFORE sending: a failed request loses one hit,
	-- which beats a retry double-counting it
	local sendHits, sendDeath = pendingHits, pendingDeath
	pendingHits, pendingDeath = 0, false

	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = ENDPOINT,
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode({
				positions = getPositions(),
				since = cursor,
				hits = sendHits,
				died = sendDeath,
			}),
		})
	end)

	if ok and res.Success then
		local good, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
		if good and data then
			for _, cmd in data.commands do
				local h = handlers[cmd.kind]
				if h then
					-- task.spawn so a handler can never stall the loop
					task.spawn(function()
						local fine, err = pcall(h, cmd)
						if not fine then warn("handler failed:", err) end
					end)
				else
					warn("no handler for kind:", cmd.kind)
				end
			end
			cursor = data.cursor

			if data.round then
				-- 1. Check for the start of the game
				if data.round.status == "live" and roundStatus ~= "live" then
					roundDeadline = os.clock() + (data.round.remainingMs / 1000)
				end

				-- 2. Check for the EXACT MOMENT the game ends
				if data.round.status == "over" and roundStatus == "live" then
					workspace.Zombies:ClearAllChildren()
					workspace.Dump:ClearAllChildren()
				end

				-- 3. Update our local tracking variables
				roundStatus    = data.round.status
				roundIntensity = data.round.intensity

				ReplicatedStorage:SetAttribute("RoundWinner", data.round.winner or "")
				ReplicatedStorage:SetAttribute("PlayerScore", data.round.playerScore or 0)
				ReplicatedStorage:SetAttribute("WebScore", data.round.webScore or 0)
			end
		end
	elseif ok then
		warn("tick failed:", res.StatusCode, res.Body)
	else
		warn("request threw:", res)
	end

	task.wait(0.3)
end