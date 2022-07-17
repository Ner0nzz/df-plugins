/*
hey welcome to my second plugin! Ner0nzz here again. if you're here to just check out/modify the code, it'd be really helpful if you could let me know of any bugs/suggestions/improvements for this code.

i've included some comments throughout that'll hopefully be helpful since the code definitely felt a lot messier this time. maybe that was because there was way more stuff that wasn't just put into functions. if a comment isn't helpful, it was probably because i was malding over draw(ctx) and/or selection areas.

==================================================================
with that out of the way, here's some initial helpful information:

viablePlanetList corresponding index info:
viablePlanetList[i] - "i" indicates information in regards to a certain planet
viablePlanetList[i][0] - the source planet locationId
viablePlanetList[i][1] - the amount of energy the source planet is predicted to spend given percentEnergyToSend
viablePlanetList[i][2] - the time it takes for a move from the source planet to arrive at the target planet. i don't think you'll see this used that much though aside from initial checks and display purposes

selectedLineInfo corresponding index info:
selectedLineInfo[0] - the corresponding source planet's locationId
selectedLineInfo[1] - the target planet's locationId
selectedLineInfo[2] - the corresponding amount of energy the source planet is predicted to spend given percentEnergyToSend

LINE_WIDTH_ERROR_FACTOR/MIN_LINE_WIDTH_SIZE - any time you see either of these, that means that the code is dealing with cursor selection areas.

*/

//i still have no idea what i'm importing lmao

import { PlanetType, SpaceType, PlanetTypeNames 
} from 'https://cdn.skypack.dev/@darkforest_eth/types'; 

import { isUnconfirmedMoveTx } from 'https://cdn.skypack.dev/@darkforest_eth/serde'; 

import { html, render, useEffect, useState, useLayoutEffect
} from 'https://unpkg.com/htm/preact/standalone.module.js';

import { getPlanetName } from 'https://cdn.skypack.dev/@darkforest_eth/procedural';


const viewport = ui.getViewport();
// hey so if you're here because you ctrl+f'ed "const viewport" from the tutorial section, looks like you've arrived at the right place. down below are the constants you're looking for.

// this code automatically calls updateViablePlanetList every so often. the amount of time is determined by UPDATE_INTERVAL, which is in seconds. if you came here from the tutorial, you don't need to worry about that one.
const UPDATE_INTERVAL = 5;
// LINE_WIDTH indicates how visually wide a line
const LINE_WIDTH = 2;
// LINE_WIDTH_ERROR_FACTOR gets multiplied by LINE_WIDTH to determine how large a line's hitbox is. if LINE_WIDTH_ERROR_FACTOR is greater than 1, then the hitbox will be larger than it looks (which is necessary at low LINE_WIDTH values)
const LINE_WIDTH_ERROR_FACTOR = 12;
// MIN_LINE_WIDTH_SIZE determines the minimum hitbox size on the universe scale. you can see it's set to 5 by default. what that means is that a line's hitbox width should always be ~5 units long.
const MIN_LINE_WIDTH_SIZE = 5;
// FONT_SIZE is the size of information like arriving energy and time to arrive
const FONT_SIZE = 15;
// ATTACK_COLOR is the color of unselected attack lines
const ATTACK_COLOR = "#d9a932";
// DOUBLE_CLICK_COLOR is the color of selected attack lines
const DOUBLE_CLICK_COLOR = "#e8663f";
//ADD_TARGET_HOTKEY is something i think you already know
const ADD_TARGET_HOTKEY = "g";
// that's all you need if you came from the tutorial


// removes all the child nodes of an element
var removeAllChildNodes = (parent) => {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
};

// makes a (sometimes) clickable planet link
var planetLink = (locationId, clickable = true) => {
    const planet = df.getPlanetWithId(locationId);
    const planetElement = document.createElement(clickable ? "button" : "span");
    planetElement.innerText = `L${planet.planetLevel}R${planet.upgradeState.reduce((a, b) => a + b, 0)} ${getPlanetName(planet)}`;
    planetElement.title = locationId;
    planetElement.style.textDecoration = "underline";
    planetElement.style.background = "none";
    planetElement.style.border = "none";
    planetElement.style.color = "white";
    planetElement.style.outline = "none";
    planetElement.style.padding = "0";
    if (clickable) {
        planetElement.addEventListener("click", () => {
            ui.centerLocationId(locationId);
        });
    }
    return planetElement;
};

class Plugin {
  constructor() {
    this.minPlanetLevel = 2;
    this.maxPlanetLevel = 4;
    this.minEnergyToSend = 2500;
    //in seconds
    this.maxTimeToSend = 300;
    this.isLinesClickable = false;
    this.percentEnergyToSend = 75;
    this.targetPlanet = '';
    
    this.viablePlanetList  = [];
    this.selectedLineInfo = [];
    this.isLineSelected = false;
    
    // i put both these values up here because i remember getting them in lineClickedAndExecute() wasn't reliable
    this.mouseXPos = 0;
    this.mouseYPos = 0;
    

  }
  // updates what planets fit the parameters set when attacking the target planet
  updateViablePlanetList () {
    console.log("updating viablePlanetList");
    this.viablePlanetList.splice(0, this.viablePlanetList.length);
    if(this.targetPlanet) {
      // get all the planets
      for (const planetInfo of df.getMyPlanets()) {
        // FILTERRRRRRRRRRRRR also the "isunconfirmedmovetx" part just checks for whether or not a planet has any unconfirmed outgoing moves
        if (isSuitablePlanet(planetInfo.locationId, this.targetPlanet, this.minEnergyToSend, this.maxTimeToSend, this.percentEnergyToSend, this.minPlanetLevel, this.maxPlanetLevel) && planetInfo.transactions?.getTransactions(isUnconfirmedMoveTx).length == 0) {
          this.viablePlanetList.push([planetInfo.locationId, planetInfo.energy * this.percentEnergyToSend / 100, df.getTimeForMove(planetInfo.locationId, this.targetPlanet)]);
          //console.log("pushing planet with locationId on updateViablePlanetList(): " + this.temporaryViablePlanetInfo[0]);
          //console.log("first locationid of item in viablePlanetList: " + this.viablePlanetList[0][0]);
        }
      }
      
      // if a line that was selected contained a source planet that didn't pass the test, the line gets unselected so it doesn't mess with the draw(ctx) function
      if (this.isLinesClickable == true && this.selectedLineInfo) {
        let confirmedViable = false;
        for (const viablePlanetInfo of this.viablePlanetList) {
          if (viablePlanetInfo[0] == this.selectedLineInfo[0]) {
            confirmedViable = true;
            break;
          }
        }
        if (!confirmedViable) {
          this.isLineSelected = false;
        }
      }
    }
  }
  
  // whenever the player clicks, this function gets called. it basically tries to determine if the player clicked a selected/unselected attack line
  lineClickedAndExecute = () => {
    // i malded for a couple hours here trying to figure out why window.addEventListener("click", this.lineClickedAndExecute) didn't call "lineClickedAndExecute()" but called "lineClickedAndExecute = () =>" just fine
    console.log("function lineClickedAndExecute called");
    if (this.isLinesClickable) {
      let sourcePlanetId = this.selectedLineInfo[0];
      let targetPlanetId = this.selectedLineInfo[1];
      
      // checks if a line has already been selected
      if (this.isLineSelected) {
        // next two if statements check if that selected line is what the player just clicked
        if (isBetweenXCoordinates(sourcePlanetId, targetPlanetId, this.mouseXPos) && isBetweenYCoordinates(sourcePlanetId, targetPlanetId, this.mouseYPos)) {
          if (isOnLine(sourcePlanetId, targetPlanetId, this.mouseXPos, this.mouseYPos)) {
            this.isLineSelected = false;
            this.updateViablePlanetList();
            df.move(sourcePlanetId, targetPlanetId, Math.ceil(this.selectedLineInfo[2]), 0);
            this.selectedLineInfo.splice(0, this.selectedLineInfo.length);
          }
          else {
          this.isLineSelected = false;
          this.selectedLineInfo.splice(0, this.selectedLineInfo.length);
          this.updateViablePlanetList();
          }
        }
        else {
          this.isLineSelected = false;
          this.selectedLineInfo.splice(0, this.selectedLineInfo.length);
          this.updateViablePlanetList();
          }
      }
      
      // so the reason why you see an "if" here rather than an "else if" is because the player might want to select a different line while another one is already selected. clicking one more time than needed might become a bit annoying.
      // if a line is not previously selected, then loop through all potential line info and see if the player did select one
      if (!this.isLineSelected) {
      for (const viablePlanetInfo of this.viablePlanetList) {
      // you'll sometimes see some debug stuff i did here. i'll leave them in in case they're helpful while modifying the code.
      /*let cursorIsBetweenSourceAndTarget = isBetweenXCoordinates(viablePlanetInfo[0], this.targetPlanet, this.mouseXPos) && isBetweenYCoordinates(viablePlanetInfo[0], this.targetPlanet, this.mouseYPos);
      console.log("The cursor is between an area made by a source and target planet: " + cursorIsBetweenSourceAndTarget);*/
        if (isBetweenXCoordinates(viablePlanetInfo[0], this.targetPlanet, this.mouseXPos) && isBetweenYCoordinates(viablePlanetInfo[0], this.targetPlanet, this.mouseYPos)) {
        //console.log("The cursor is on an attack line: " + isOnLine(viablePlanetInfo[0], this.targetPlanet, this.mouseXPos, this.mouseYPos));
          if (isOnLine(viablePlanetInfo[0], this.targetPlanet, this.mouseXPos, this.mouseYPos)) {
            this.selectedLineInfo.splice(0, this.selectedLineInfo.length);
            this.selectedLineInfo.push(viablePlanetInfo[0], this.targetPlanet, viablePlanetInfo[1]);
            this.isLineSelected = true;
            }
          }  
        }
      }
    }
  }
  
  //this gets called every time the player moves their cursor
  getMousePosition = () => {
    if(ui.getHoveringOverCoords()) {
      this.mouseXPos = ui.getHoveringOverCoords().x;
      this.mouseYPos = ui.getHoveringOverCoords().y;
      }
  }
  
  /**
   * Called when plugin is launched with the "run" button.
   */
  render(container) {
    container.parentElement.style.minHeight = 'unset';
    container.style.minHeight = 'unset';
    container.style.width = '260px';
    window.addEventListener("click", this.lineClickedAndExecute);
    window.addEventListener("mousemove", this.getMousePosition);
    //stole some code from blainebublitz/phated's "custom hotkeys" plugin to make this work. the hotkey here is ADD_TARGET_HOTKEY. i promise to make this code not look like trash in another update lol
    window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case ADD_TARGET_HOTKEY:
          removeAllChildNodes(targetPlanetContainer);
      const selectedTargetPlanet = ui.getSelectedPlanet();
      if (selectedTargetPlanet) {
          this.targetPlanet = selectedTargetPlanet.locationId;
          if (setMinEnergyToTargetCapInput.checked == true) {
            this.minEnergyToSend = df.getPlanetWithId(this.targetPlanet).energyCap * df.getPlanetWithId(this.targetPlanet).defense / 100;
            minEnergyToSendInput.value = this.minEnergyToSend;
      }
          //basically every input the player makes inside this plugin will be calling updateViablePlanetList(). very important function.
          this.updateViablePlanetList();
      }
      // make the planet either be "none" when nothing is selected, or the planet link.
      targetPlanetContainer.append("Current target: ", selectedTargetPlanet ? planetLink(selectedTargetPlanet.locationId) : "none");
        ;
        break;
    }});
    
    const targetPlanetContainer = document.createElement("div");
    targetPlanetContainer.innerText = "Current target: none";
    
    const addTargetButton = document.createElement("button");
    addTargetButton.innerText = "Add target [g]";
    addTargetButton.style.marginRight = "10px";
    addTargetButton.addEventListener("click", () => {
      removeAllChildNodes(targetPlanetContainer);
      const selectedTargetPlanet = ui.getSelectedPlanet();
      if (selectedTargetPlanet) {
          this.targetPlanet = selectedTargetPlanet.locationId;
          if (setMinEnergyToTargetCapInput.checked == true) {
            this.minEnergyToSend = df.getPlanetWithId(this.targetPlanet).energyCap * df.getPlanetWithId(this.targetPlanet).defense / 100;
            minEnergyToSendInput.value = this.minEnergyToSend;
      }
          //basically every input the player makes inside this plugin will be calling updateViablePlanetList(). very important function.
          this.updateViablePlanetList();
      }
      // make the planet either be "none" when nothing is selected, or the planet link.
      targetPlanetContainer.append("Current target: ", selectedTargetPlanet ? planetLink(selectedTargetPlanet.locationId) : "none");
    });
    
    const clearTargetButton = document.createElement("button");
    clearTargetButton.innerText = "Clear lines";
    clearTargetButton.style.marginRight = "10px";
    clearTargetButton.addEventListener("click", () => {
      removeAllChildNodes(targetPlanetContainer);
      targetPlanetContainer.append("Current target: none");
      this.targetPlanet = '';
    });
    
    //zzzzzzzz i should probably just create a function that makes element input settings for me rather than copypasting the same thing everywhere...
    const minPlanetLevelInput = document.createElement("input");
    minPlanetLevelInput.style.textAlign = "right";
    minPlanetLevelInput.style.marginLeft = "74px";
    minPlanetLevelInput.style.background = 'rgb(8,8,8)';
    minPlanetLevelInput.style.width = "50px";
    minPlanetLevelInput.setAttribute("type", "number");
    minPlanetLevelInput.value = this.minPlanetLevel;
    minPlanetLevelInput.addEventListener('focus', () => {minPlanetLevelInput.select()});
    minPlanetLevelInput.onchange = () => {
      this.minPlanetLevel = minPlanetLevelInput.value;
      this.updateViablePlanetList();
    }
  
  const maxPlanetLevelInput = document.createElement("input");
    maxPlanetLevelInput.style.textAlign = "right";
    maxPlanetLevelInput.style.marginLeft = "74px";
    maxPlanetLevelInput.style.background = 'rgb(8,8,8)';
    maxPlanetLevelInput.style.width = "50px";
    maxPlanetLevelInput.setAttribute("type", "number");
    maxPlanetLevelInput.value = this.maxPlanetLevel;
    maxPlanetLevelInput.addEventListener('focus', () => {maxPlanetLevelInput.select()});
    maxPlanetLevelInput.onchange = () => {
      this.maxPlanetLevel = maxPlanetLevelInput.value;
      this.updateViablePlanetList();
    }
    
    const minEnergyToSendInput = document.createElement("input");
    minEnergyToSendInput.style.textAlign = "right";
    minEnergyToSendInput.style.marginLeft = "50px";
    minEnergyToSendInput.style.background = 'rgb(8,8,8)';
    minEnergyToSendInput.style.width = "50px";
    minEnergyToSendInput.setAttribute("type", "number");
    minEnergyToSendInput.value = this.minEnergyToSend;
    minEnergyToSendInput.addEventListener('focus', () => {minEnergyToSendInput.select()});
    minEnergyToSendInput.onchange = () => {
      this.minEnergyToSend = minEnergyToSendInput.value;
      this.updateViablePlanetList();
    }
    
    let setMinEnergyToTargetCapInput = document.createElement('input');
    setMinEnergyToTargetCapInput.type = "checkbox";
    setMinEnergyToTargetCapInput.style.textAlign = "right";
    setMinEnergyToTargetCapInput.style.marginLeft = "43px";
    setMinEnergyToTargetCapInput.checked = false;
    setMinEnergyToTargetCapInput.onchange = () => {
      if (setMinEnergyToTargetCapInput.checked == true) {
      // probably should account for planet energyCap overflow but ehhhhhhhhhhhhhhhhhhhhhhhhhhh...
        this.minEnergyToSend = df.getPlanetWithId(this.targetPlanet).energyCap * df.getPlanetWithId(this.targetPlanet).defense / 100;
        minEnergyToSendInput.value = this.minEnergyToSend;
      }
      this.updateViablePlanetList();
    }
    
    const maxTimeToSendInput = document.createElement("input");
    maxTimeToSendInput.style.textAlign = "right";
    maxTimeToSendInput.style.marginLeft = "74px";
    maxTimeToSendInput.style.background = 'rgb(8,8,8)';
    maxTimeToSendInput.style.width = "50px";
    maxTimeToSendInput.setAttribute("type", "number");
    maxTimeToSendInput.value = this.maxTimeToSend;
    maxTimeToSendInput.addEventListener('focus', () => {maxTimeToSendInput.select()})
    maxTimeToSendInput.onchange = () => {
      this.maxTimeToSend = maxTimeToSendInput.value;
      this.updateViablePlanetList();
    }
    
    let isLinesClickableButton = document.createElement('input');
    isLinesClickableButton.type = "checkbox";
    isLinesClickableButton.style.textAlign = "right";
    isLinesClickableButton.style.marginLeft = "100px";
    isLinesClickableButton.checked = false;
    isLinesClickableButton.onchange = () => {
      this.isLinesClickable = isLinesClickableButton.checked;
      this.updateViablePlanetList();
    }
    
    let percentEnergyToSendInput = document.createElement('input');
    percentEnergyToSendInput.type = 'range';
    percentEnergyToSendInput.min = '0';
    percentEnergyToSendInput.max = '100';
    percentEnergyToSendInput.step = '1';
    percentEnergyToSendInput.value = this.percentEnergyToSend;
    percentEnergyToSendInput.style.width = '100%';
    percentEnergyToSendInput.style.height = '24px';
    percentEnergyToSendInput.style.marginTop = '10px';

    let percentEnergyInfo = document.createElement('span');
    percentEnergyInfo.innerText = `Use ${this.percentEnergyToSend}% of planet energy`;
    percentEnergyInfo.style.display = 'block';

    //am gonna be honest, i don't actually know why i have this section below. i just copypasted it in just in case lol. probably could simplify things down a little bit if i thought for 5 seconds but i guess ill take the free debug tool for now
    percentEnergyToSendInput.onchange = (evt) => {
      try {
        this.percentEnergyToSend = parseInt(evt.target.value, 10);
        percentEnergyInfo.innerText = `Use ${this.percentEnergyToSend}% of planet energy`;
        this.updateViablePlanetList();
      } catch (e) {
        console.error('could not parse percent energy', e);
      }
    }
    
    //timer runs through updateViablePlanetList() and setMinEnergyToTargetCapInput every UPDATE_INTERVAL seconds
    this.timerId = setInterval(() => {
          setTimeout(this.updateViablePlanetList(), 0);
          if (setMinEnergyToTargetCapInput.checked == true) {
        this.minEnergyToSend = df.getPlanetWithId(this.targetPlanet).energyCap * df.getPlanetWithId(this.targetPlanet).defense / 100;
        minEnergyToSendInput.value = this.minEnergyToSend;
      }
        }, 1000 * UPDATE_INTERVAL)
    
    //just the tutorial section. not very interesting
    const tutorialSection = document.createElement("div");
    const tutorialText1 = document.createElement("div");
    tutorialText1.innerText = "Heyoooo Ner0nzz here! Here's a brief intro on how to use this pvp-oriented plugin as well as other info you might find helpful.";
    tutorialText1.style.color = "#fcc203";
    const tutorialText2 = document.createElement("div");
    tutorialText2.innerText = "What this plugin essentially does is it very conveniently feeds you information on your capabilities in attacking a certain planet. In order to set a specified target, click the Add target button after selecting a planet. You'll notice a lot of potential attack lines as well as estimated arriving energy and time to send appearing on your UI. I'm pretty sure you know what the Clear lines button does.";
    tutorialText2.style.fontSize = "10px";
    tutorialText2.style.color = "#fcc203";
    const tutorialText3 = document.createElement("div");
    tutorialText3.innerText = "The cool thing about this plugin is that if you check the checkbox next to the Lines Clickable setting, you'll notice that you can now interact with said lines. Clicking a selected line again will send the displayed attack. Clicking anywhere else will deselect the line."
    tutorialText3.style.fontSize = "12px";
    tutorialText3.style.color = "#fcc203";
    const tutorialText4 = document.createElement("div");
    tutorialText4.innerText = "The rest is pretty simple. Min/Max Source Level filters out your planets with too high/low planet levels. Min Arriving Energy refers to the min arriving energy when attacking the target planet. The Set Min Energy checkbox takeover threshold refers to how much energy is needed to take over the target planet. Max Arrival Time is in seconds. The bottom slider refers to the percentage of a source planet's energy will be considered to be used in an attack.";
    tutorialText4.style.fontSize = "9px";
    tutorialText4.style.color = "#fcc203";
    const tutorialText5 = document.createElement("div");
    tutorialText5.innerText = "That's pretty much everything you need to know in order to use this. If you want to mess around with the way the attack lines look, open up the code and ctrl+f the first result of [const viewport] and there will be more info there. GLHF!";
    tutorialText5.style.fontSize = "12px";
    tutorialText5.style.color = "#fcc203";
    const tutorialTextList = [tutorialText1, tutorialText2, tutorialText3, tutorialText4, tutorialText5];
    let currentPage = 0;
    const tutorialNextButton = document.createElement("button");
    tutorialNextButton.innerText = "Next page";
    tutorialNextButton.style.marginRight = "10px";
    tutorialNextButton.addEventListener("click", () => {
      if (currentPage < tutorialTextList.length - 1) {
        tutorialSection.removeChild(tutorialTextList[currentPage]);
        tutorialSection.appendChild(tutorialTextList[currentPage + 1]);
        currentPage++;
      }
    });
    const tutorialBackButton = document.createElement("button");
    tutorialBackButton.innerText = "Previous page";
    tutorialBackButton.style.marginRight = "10px";
    tutorialBackButton.addEventListener("click", () => {
      if (currentPage != 0) {
        tutorialSection.removeChild(tutorialTextList[currentPage]);
        tutorialSection.appendChild(tutorialTextList[currentPage - 1]);
        currentPage--;
      }
    });
    const deleteTutorialButton = document.createElement("button");
    deleteTutorialButton.innerText = "Close tutorial";
    deleteTutorialButton.style.marginRight = "10px";
    deleteTutorialButton.addEventListener("click", () => {
      container.removeChild(tutorialSection);
    });
    
    tutorialSection.appendChild(tutorialBackButton);
    tutorialSection.appendChild(tutorialNextButton);
    tutorialSection.appendChild(deleteTutorialButton);
    tutorialSection.appendChild(tutorialText1);
    //end of tutorial section
    
    // all these containers eventually get appended to the main render(container) so process goes:
    //input box => input container + info => render(container)
    const minPlanetLevelContainer = document.createElement("div");
    minPlanetLevelContainer.innerText = "Min Source Level:";
    minPlanetLevelContainer.append(minPlanetLevelInput);
    const maxPlanetLevelContainer = document.createElement("div");
    maxPlanetLevelContainer.innerText = "Max Source Level:";
    maxPlanetLevelContainer.append(maxPlanetLevelInput);
    const minSendableEnergyContainer = document.createElement("div");
    minSendableEnergyContainer.innerText = "Min Arriving Energy:";
    minSendableEnergyContainer.append(minEnergyToSendInput);
    const minSetSendableEnergyContainer = document.createElement("div");
    minSetSendableEnergyContainer.innerText = "Set Min Energy to Takeover Threshold?";
    minSetSendableEnergyContainer.style.fontSize = "10px";
    minSetSendableEnergyContainer.append(setMinEnergyToTargetCapInput);
    const maxArrivalTimeContainer = document.createElement("div");
    maxArrivalTimeContainer.style.marginTop = "10px";
    maxArrivalTimeContainer.innerText = "Max Arrival Time:";
    maxArrivalTimeContainer.append(maxTimeToSendInput);
    const linesClickableContainer = document.createElement("div");
    linesClickableContainer.innerText = "Lines Clickable?";
    linesClickableContainer.append(isLinesClickableButton);
    
    container.appendChild(tutorialSection);
    container.appendChild(targetPlanetContainer);
    container.appendChild(addTargetButton);
    container.appendChild(clearTargetButton);
    container.appendChild(minPlanetLevelContainer);
    container.appendChild(maxPlanetLevelContainer);
    container.appendChild(minSendableEnergyContainer);
    container.appendChild(minSetSendableEnergyContainer);
    container.appendChild(maxArrivalTimeContainer);
    container.appendChild(linesClickableContainer);
    container.appendChild(percentEnergyToSendInput);
    container.appendChild(percentEnergyInfo);
  }
  
  draw(ctx) {
    ctx.strokeStyle = ATTACK_COLOR;
    ctx.lineWidth = LINE_WIDTH;
  
    // draw(ctx) only displays stuff if a there is a target planet
    if (this.targetPlanet) {
      for (const viablePlanetInfo of this.viablePlanetList) {
        let sourcePlanet = df.getPlanetWithId(viablePlanetInfo[0]);
        let targetPlanet = df.getPlanetWithId(this.targetPlanet);
        
        //locations in the middle of the source planet and the target planet. the reason why y coordinates have the "+- 10" stuff is to prevent the info overlapping
        let sourceTargetMidX = viewport.worldToCanvasX((sourcePlanet.location.coords.x + targetPlanet.location.coords.x) / 2);
        let sourceTargetMidYEnergy = viewport.worldToCanvasY((sourcePlanet.location.coords.y + targetPlanet.location.coords.y) / 2) - 10;
        let sourceTargetMidYTime = viewport.worldToCanvasY((sourcePlanet.location.coords.y + targetPlanet.location.coords.y) / 2) + 10;
        
        //begins drawing an unselected attack line
        ctx.beginPath();
        ctx.moveTo(viewport.worldToCanvasX(sourcePlanet.location.coords.x), viewport.worldToCanvasY(sourcePlanet.location.coords.y));
        //console.log("Current source planet x coordinates: " + sourcePlanet.location.coords.x);
        //console.log("Coordinates for moveTo function in draw(ctx): " + viewport.worldToCanvasX(sourcePlanet.location.coords.x) + ", " + viewport.worldToCanvasY(sourcePlanet.location.coords.y));
        ctx.lineTo(viewport.worldToCanvasX(targetPlanet.location.coords.x), viewport.worldToCanvasY(targetPlanet.location.coords.y));
        ctx.stroke();
        //finishes drawing an unselected attack line
        
        ctx.font = `${FONT_SIZE}px Inconsolata`;
        ctx.fillStyle = "white";
        
        // displays both the energy and time in the middle of the attack line. the reason why things like "toString().length" is also there is because without it, the text's leftmost side is positioned at the middle of the line. the "toString().length" part adjusts for that and makes sure the middle of the text is positioned at the middle.
        ctx.fillText(Math.ceil(df.getEnergyArrivingForMove(viablePlanetInfo[0], this.targetPlanet, undefined, viablePlanetInfo[1])), sourceTargetMidX - Math.ceil(df.getEnergyArrivingForMove(viablePlanetInfo[0], this.targetPlanet, undefined, viablePlanetInfo[1])).toString().length * FONT_SIZE / 4, sourceTargetMidYEnergy);
        ctx.fillText(Math.ceil(viablePlanetInfo[2]) + " sec", sourceTargetMidX - (Math.ceil(viablePlanetInfo[2]).toString().length + 4) * FONT_SIZE / 4, sourceTargetMidYTime);
      }
      
      // if a line has already been selected, then draw over it with a different color
      if (this.isLineSelected && this.isLinesClickable && this.selectedLineInfo.length != 0) {
        ctx.strokeStyle = DOUBLE_CLICK_COLOR;
        ctx.lineWidth = LINE_WIDTH * 1.1;
        ctx.beginPath();
        ctx.moveTo(viewport.worldToCanvasX(df.getPlanetWithId(this.selectedLineInfo[0]).location.coords.x), viewport.worldToCanvasY(df.getPlanetWithId(this.selectedLineInfo[0]).location.coords.y));
  ctx.lineTo(viewport.worldToCanvasX(df.getPlanetWithId(this.selectedLineInfo[1]).location.coords.x), viewport.worldToCanvasY(df.getPlanetWithId(this.selectedLineInfo[1]).location.coords.y));
        ctx.stroke();
      }
    }
  }

  /**
   * Called when plugin modal is closed.
   */
  destroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
    window.removeEventListener("click", this.lineClickedAndExecute);
    window.removeEventListener("click", this.getMousePosition);
    window.removeEventListener("keydown", (e) => {
    switch (e.key) {
      case ADD_TARGET_HOTKEY:
          removeAllChildNodes(targetPlanetContainer);
      const selectedTargetPlanet = ui.getSelectedPlanet();
      if (selectedTargetPlanet) {
          this.targetPlanet = selectedTargetPlanet.locationId;
          if (setMinEnergyToTargetCapInput.checked == true) {
            this.minEnergyToSend = df.getPlanetWithId(this.targetPlanet).energyCap * df.getPlanetWithId(this.targetPlanet).defense / 100;
            minEnergyToSendInput.value = this.minEnergyToSend;
      }
          //basically every input the player makes inside this plugin will be calling updateViablePlanetList(). very important function.
          this.updateViablePlanetList();
      }
      // make the planet either be "none" when nothing is selected, or the planet link.
      targetPlanetContainer.append("Current target: ", selectedTargetPlanet ? planetLink(selectedTargetPlanet.locationId) : "none");
        ;
        break;
    }});
  }
}

// somewhere inside DFGAIA there already exists all these functions i made from scratch right?

// gets called repeatedly within updateViablePlanetList() in order to check if a planet fits inside the parameters set by the player
function isSuitablePlanet (sourcePlanetId, targetPlanetId, minEnergySendable, maxTimeSpendable, percentEnergySendable, minLevelThreshold, maxLevelThreshold) {
  let sourcePlanet = df.getPlanetWithId(sourcePlanetId);
  let targetPlanet = df.getPlanetWithId(targetPlanetId);
  if (sourcePlanet.planetLevel >= minLevelThreshold && sourcePlanet.planetLevel <= maxLevelThreshold
  && df.getEnergyArrivingForMove(sourcePlanetId, targetPlanetId, undefined, sourcePlanet.energy * percentEnergySendable / 100) >= minEnergySendable
  && df.getTimeForMove(sourcePlanetId, targetPlanetId)) {
    return true;
  }
  return false;
}

// checks if a mouse click is between the x coordinates of the source and target planet
function isBetweenXCoordinates(sourcePlanetId, targetPlanetId, mouseX) {
  let sourcePlanetX = df.getPlanetWithId(sourcePlanetId).location.coords.x;
  let targetPlanetX = df.getPlanetWithId(targetPlanetId).location.coords.x;
  if (targetPlanetX - sourcePlanetX > 0) {
    if (mouseX <= targetPlanetX + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) && mouseX >= sourcePlanetX - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE)) {
    return true;
    }
  }
  
  else if (targetPlanetX - sourcePlanetX < 0) {
    if (mouseX >= targetPlanetX - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) && mouseX <= sourcePlanetX + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE)) {
    return true;
    }
  }
  
  // this last part is for edge cases where both the target and source planet have the same x coordinates
  else if (targetPlanetX - sourcePlanetX == 0) {
    if (mouseX <= targetPlanetX + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) || mouseX >= targetPlanetX - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE)) {
    return true;
    }
  }
  
  else {
  return false;
  }
}

// checks if a mouse click is between the y coordinates of the source and target planet
function isBetweenYCoordinates(sourcePlanetId, targetPlanetId, mouseY) {
  let sourcePlanetY = df.getPlanetWithId(sourcePlanetId).location.coords.y;
  let targetPlanetY = df.getPlanetWithId(targetPlanetId).location.coords.y;
  if (targetPlanetY - sourcePlanetY > 0) {
    if (mouseY <= targetPlanetY +  (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) && mouseY >= sourcePlanetY - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE)) {
    return true;
    }
  }
  
  else if (targetPlanetY - sourcePlanetY < 0) {
    if (mouseY >= targetPlanetY -  (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) && mouseY <= sourcePlanetY + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE)) {
    return true;
    }
  }
  
  // this last part is for edge cases where both the target and source planet have the same y coordinates
  else if (targetPlanetY - sourcePlanetY == 0) {
    if (mouseY <= targetPlanetY + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) || mouseY >= targetPlanetY - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE)) {
    return true;
    }
  }
  
  else {
  return false;
  }
}

// gets the slope of the line between the source and target planet
function getLineSlope (sourcePlanetId, targetPlanetId) {
  return (df.getPlanetWithId(sourcePlanetId).location.coords.y - df.getPlanetWithId(targetPlanetId).location.coords.y) / (df.getPlanetWithId(sourcePlanetId).location.coords.x - df.getPlanetWithId(targetPlanetId).location.coords.x);
}

// gets the inverseSlope of the line between the source and target planet
// lulw almost called "inverse slope" as "inverted slope"
function getInverseLineSlope (sourcePlanetId, targetPlanetId) {
  return (df.getPlanetWithId(sourcePlanetId).location.coords.x - df.getPlanetWithId(targetPlanetId).location.coords.x) / (df.getPlanetWithId(sourcePlanetId).location.coords.y - df.getPlanetWithId(targetPlanetId).location.coords.y);
}

// final check for whether or not a click was on top of an attack line
function isOnLine (sourcePlanetId, targetPlanetId, mouseX, mouseY) {
  let sourcePlanet = df.getPlanetWithId(sourcePlanetId);
  let targetPlanet = df.getPlanetWithId(targetPlanetId);
  let slope = getLineSlope(sourcePlanetId, targetPlanetId);
  let inverseSlope = getInverseLineSlope(sourcePlanetId, targetPlanetId);
  
  //console.log("slope of current line: " + slope);
  //console.log("inverse slope of current line: " + inverseSlope);
  
  //edge case if slope between source/target planets is undefined, note that the meaning bValue may not be accurate when applied to y = mx + b
  if (slope == 1 / 0 || slope == (0 - 1) / 0) {
    //console.log("slope is undefined");
    let bValue = sourcePlanet.location.coords.x;
    if (Math.ceil(mouseX) < bValue + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) / 2 && Math.ceil(mouseX) > bValue - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) / 2) {
    return true;
    }
  }
  
  //edge case if slope between source/target planets is 0, this time the meaning of bValue ia accurate when applied to y = mx + b (i think)
  else if (slope == 0) {
    //console.log ("slope is 0");
    let bValue = sourcePlanet.location.coords.y;
    if (Math.ceil(mouseY) < bValue + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) / 2 && Math.ceil(mouseY) > bValue - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) / 2) {
    return true;
    }
  }
  
  //this is the real deal down below. you might not want to touch this part
  else {
    let bValue = sourcePlanet.location.coords.y - sourcePlanet.location.coords.x * slope;
    let inverseBValue = sourcePlanet.location.coords.x - sourcePlanet.location.coords.y * inverseSlope;
    
    /*console.log("==============regular line case detected==============");
    console.log("source planet coords: " + sourcePlanet.location.coords.x + ", " + sourcePlanet.location.coords.y);
    console.log("cursor x pos: " + mouseX);
    console.log("cursor y pos: " + mouseY);
    console.log("b Value: " + bValue);
    console.log("inverse b value: " + inverseBValue);
    console.log("first test case results: " + (Math.ceil(mouseY) <= Math.ceil(mouseX * slope + bValue + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(slope) / Math.PI))));
    console.log("is " + Math.ceil(mouseY) + " <= " + Math.ceil(mouseX * slope + bValue + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(slope) / Math.PI)) + "?");
    console.log("second test case results: " + (Math.ceil(mouseY) >= Math.ceil(mouseX * slope + bValue - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(slope) / Math.PI))));
    console.log("is " + Math.ceil(mouseY) + " >= " + Math.ceil(mouseX * slope + bValue - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(slope) / Math.PI)) + "?");
    console.log("third test case results: " + (Math.ceil(mouseX) <= Math.ceil(mouseY * inverseSlope + inverseBValue + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(inverseSlope) / Math.PI))));
    console.log("is " + Math.ceil(mouseX) + " <= " + Math.ceil(mouseY * inverseSlope + inverseBValue + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(inverseSlope) / Math.PI)) + "?");
    console.log("fourth test case results: " + (Math.ceil(mouseX) >= Math.ceil(mouseY * inverseSlope + inverseBValue - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(inverseSlope) / Math.PI))));
    console.log("is " + Math.ceil(mouseX) + " >= " + Math.ceil(mouseY * inverseSlope + inverseBValue - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(inverseSlope) / Math.PI)) + "?");*/

      //the following is basically just checking if some position is on the line between the source planet and the target planet with some error bars involved. think y = (mx + b) +- LINE_WIDTH but with unit circle stuff to make selection more accurate. 
      //the reason why Math.atan and Math.PI are in there is so the line selection hitbox actually follows the line itself no matter what the slope is as opposed to just having the error values be boringly static. so if a person decides they want the attack lines to take up half the screen, they'll have me to thank for accurate selection boxes.
      // also if you think this formatting was bad, you should've seen my initial pseudocode lmao it looked like total trash on top of just being wrong
      if (Math.ceil(mouseY) <= Math.ceil(mouseX * slope + bValue + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(slope) / Math.PI)) 
      && Math.ceil(mouseY) >= Math.ceil(mouseX * slope + bValue - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(slope) / Math.PI))
      && Math.ceil(mouseX) <= Math.ceil(mouseY * inverseSlope + inverseBValue + (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(inverseSlope) / Math.PI))
      && Math.ceil(mouseX) >= Math.ceil(mouseY * inverseSlope + inverseBValue - (viewport.canvasToWorldDist(LINE_WIDTH * LINE_WIDTH_ERROR_FACTOR) + MIN_LINE_WIDTH_SIZE) * Math.abs(Math.atan(inverseSlope) / Math.PI))) {
        return true;
      }
      else {
      return false;
      }
  }
}


/**
 * And don't forget to export it! :))))))))))))))))))))))))))))))))))))))))))))))))))))))))
 */
export default Plugin;
