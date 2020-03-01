class Servant {
    constructor(info) {
        this.ID = Number(info.id);
        this.UniqueID = Number(info.dbid);
        this.Name = info.name;
    }

    stringify() {
        return {name: this.Name, id: this.ID.toString(), dbid: this.UniqueID.toString()};
    }
}

class Player {
    constructor() {
        this.w;
        this.loc;
    }
}

const brooch = [19702, 19703, 19705, 19706, 51011, 51028, 51029, 51030, 98404, 98405, 98406]
module.exports = function AutoPet(mod) {
    const Vec3 = require('tera-vec3');
    mod.game.initialize("inventory");

    let gameId,
        charId,
        petId = null,
        getbondSkill = false
    let inCombat = false;
    let petSummoned = false;
    let newServant = null;
    let mainServant = null;
    let player = new Player();
    let petGameId;

    // Commands
    mod.command.add('pet', (sub, subc, value) => {
        switch(sub) {
            case 'save':
                if (newServant) {
                    saveServant();
                } else {
                    mod.command.message("You must summon a pet first before you can save it.")
                }
                break;
            case 'feed':
                let n = Number(subc);
                if (isNaN(n) || n >= 100 || n < 0) {
                    mod.command.message("Pet Stamina % must be set between 1 and 99.")
                } else {
                    mod.settings.feedWhenBelow = n;
                    mod.command.message(`Auto feed is now set to <font color="#5da8ce">${n}%</font>`)
                }
                break;
            case 'on':
                    mod.settings.characters[charId].enabled = 1
                    command.message('Module <font color="#00FF00">Enabled</font> for <font color="#00BFFF">' + mod.settings.characters[charId].name + '</font>')
                    break;
            case 'off':
                    mod.settings.characters[charId].enabled = 0
                    command.message('Module <font color="#FF0000">Disabled</font> for <font color="#00BFFF">' + mod.settings.characters[charId].name + '</font>')
                    break;
            case 'bond':
                    getbondSkill = true
                    command.message('Press your pet skill now to save it in the config' )
                    break;
            case 'delay':
                mod.settings.characters[charId].delay = value
                    command.message('Bracing Force will be delayed by <font color="#DB3DCE">' + value + 'ms</font> after using brooch.')
                    break;
            default:
                mod.settings.enabled = !mod.settings.enabled;
                mod.command.message(`Auto Pet is now ${mod.settings.enabled ? '<font color="#5dce6a">Enabled</font>' : '<font color="#dc4141">Disabled</font>'}.`)
        }
    })

    mod.hook('S_LOGIN', 14, event => {
		gameId = event.gameId;
		charId = `${event.playerId}_${event.serverId}`;
		if (mod.settings.characters[charId] == undefined) {
			mod.settings.characters[charId] = {
				"name": event.name,
				"enabled": 1,
				"bondSkill": 0,
				"delay": 1
			}
		}
     })
     
     mod.hook('C_USE_ITEM', 3, event => {
		if(mod.settings.characters[charId].enabled == 1&& brooch.includes(event.id) && petId !== null) {
			setTimeout(function(){
				mod.send('C_START_SERVANT_ACTIVE_SKILL', 1, {
					gameId: petId,
					skill: mod.settings.characters[charId].bondSkill
				})
			}, mod.settings.characters[charId].delay)
		}
	})
	
	mod.hook('S_REQUEST_SPAWN_SERVANT', 4, event => {
		if(event.ownerId === gameId) petId = event.gameId
	})
	
	mod.hook('S_REQUEST_DESPAWN_SERVANT', 1, event => {
		if(event.gameId === petId) petId = null
	})
	
	mod.hook('C_START_SERVANT_ACTIVE_SKILL', 1, event => {
		if(getbondSkill) {
			getbondSkill = false
			mod.settings.characters[charId].bondSkill = event.skill
			command.message('Bracing Force Skill ID <font color="#F1D448">' + event.skill + '</font> saved for <font color="#00BFFF">' + mod.settings.characters[charId].name + '</font>')
		}
	})
	

    // Game states
    mod.game.me.on('enter_combat', () => {
        inCombat = true;
    })

    mod.game.me.on('leave_combat', () => {
        inCombat = false;
    })

    // Hooks
    mod.hook('C_PLAYER_LOCATION', 5, (event) => {
        let x = (event.loc.x + event.dest.x) / 2;
        let y = (event.loc.y + event.dest.y) / 2;
        let z = (event.loc.z + event.dest.z) / 2;
        player.loc = new Vec3(x, y, z);
		player.w = event.w;
    })

    mod.hook('S_REQUEST_SPAWN_SERVANT', 4, (event) => {
        if (event.ownerId == mod.game.me.gameId) {
            newServant = new Servant(event);
            petSummoned = true;
            petGameId = event.gameId;
            if (mainServant == null || newServant.ID != mainServant.ID) {
                mod.command.message(`Use 'pet save' to save <font color="#30e785">"${event.name}"</font> as your default pet`);
            }
        }
    })

    mod.hook('S_REQUEST_DESPAWN_SERVANT', 1, (event) => {
        if (event.gameId == petGameId) {
            petSummoned = false;
            newServant = null;
        }
    })

    mod.hook('S_UPDATE_SERVANT_INFO', 1, (event) => {
        if (event.dbid == mainServant.UniqueID) {
            const energy = (event.energy / 300) * 100;
            if (energy <= mod.settings.feedWhenBelow && !inCombat && petSummoned && mod.settings.enabled) {
                feedPet();
            }
        }
    })

    mod.hook('S_VISIT_NEW_SECTION', 1, (event) => {
        const key = `${mod.game.me.serverId}_${mod.game.me.playerId}`;
        const playerPet = mod.settings.servantsList[key];
        if (playerPet != undefined) {
            mainServant = new Servant(playerPet);
        }
        if (mainServant && !petSummoned && mod.settings.enabled) {
            SummonPet();
        }
    })

    // Functions
    function SummonPet() {
        mod.send('C_REQUEST_SPAWN_SERVANT', 1, {
            servantId : mainServant.ID,
            uniqueId : mainServant.UniqueID,
            unk : 0
        })
    }

    function saveServant() {
        const newKey = `${mod.game.me.serverId}_${mod.game.me.playerId}`;
        mod.settings.servantsList[newKey] = newServant.stringify();
        mod.command.message(`Saved <font color="#30e785">"${newServant.Name}"</font> as your default pet."`);
        mainServant = newServant;
    }

    function feedPet() {
        const foods = mod.settings.petFood;
        let foodFound = false;
        foods.forEach(food => {
            let Food = mod.game.inventory.findInBagOrPockets(food.id)
            if (Food) {
                foodFound = true;
                givePetFood(Food);
                return;
            }
        })
        if (!foodFound) {
            mod.command.message("You don't have any pet food in inventory!")
        }
    }

    function givePetFood(food) {
        mod.send('C_USE_ITEM', 3, {
            gameId: mod.game.me.gameId,
            id: food.id,
            dbid: food.dbid,
            target: 0,
            amount: 1,
            dest: 0,
            loc: player.loc,
            w: player.w,
            unk1: 0,
            unk2: 0,
            unk3: 0,
            unk4: true
        })
    }

}