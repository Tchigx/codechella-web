local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local remotes = Instance.new("Folder")
remotes.Name = "SwordRemotes"
remotes.Parent = ReplicatedStorage

local EquipRemote = Instance.new("RemoteEvent")
EquipRemote.Name = "Equip"
EquipRemote.Parent = remotes

local SWORD    = ReplicatedStorage.Weapons.Sword
local DAMAGE   = 50
local COOLDOWN = 0.6
local WINDOW   = { 0.15, 0.45 }

local lastSwing = {}

local function getTool(plr)
	local char = plr.Character
	return (char and char:FindFirstChild("Sword"))
		or (plr:FindFirstChild("Backpack") and plr.Backpack:FindFirstChild("Sword"))
end

local function doSwing(plr, tool)
	local now = os.clock()
	if lastSwing[plr] and now - lastSwing[plr] < COOLDOWN then return end
	lastSwing[plr] = now

	local char = plr.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local animator = hum and hum:FindFirstChildOfClass("Animator")

	if animator then
		local pool = ReplicatedStorage.Anims:GetChildren()
		local pick = pool[math.random(#pool)]
		if pick and pick:IsA("Animation") then
			animator:LoadAnimation(pick):Play()
		end
	end

	local blade = tool:FindFirstChild("Blade") or tool:FindFirstChild("Handle")
	if not blade then return end

	local params = OverlapParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { workspace:WaitForChild("Zombies") }

	task.spawn(function()
		task.wait(WINDOW[1])
		local hitThisSwing = {}
		local deadline = os.clock() + (WINDOW[2] - WINDOW[1])

		while os.clock() < deadline do
			for _, part in workspace:GetPartsInPart(blade, params) do
				local zh = part.Parent and part.Parent:FindFirstChildOfClass("Humanoid")
				if zh and zh.Health > 0 and not hitThisSwing[zh] then
					hitThisSwing[zh] = true
					zh:TakeDamage(DAMAGE)
				end
			end
			task.wait(0.05)
		end
	end)
end

local function giveSword(plr)
	local clone = SWORD:Clone()
	clone.Name = "Sword"
	clone.CanBeDropped = false
	clone.Parent = plr.Backpack
	clone.Activated:Connect(function() doSwing(plr, clone) end)
	return clone
end

EquipRemote.OnServerEvent:Connect(function(plr, wantEquipped)
	local char = plr.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hum then return end

	local tool = getTool(plr) or giveSword(plr)

	if wantEquipped then
		hum:EquipTool(tool)
	else
		hum:UnequipTools()
	end
end)

Players.PlayerAdded:Connect(function(plr)
	plr.CharacterAdded:Connect(function()
		task.wait(0.2)
		lastSwing[plr] = nil
		if not getTool(plr) then giveSword(plr) end
	end)
end)

Players.PlayerRemoving:Connect(function(plr) lastSwing[plr] = nil end)