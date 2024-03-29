/*
heyoo Ner0nzz here. seems like you might be interested in editing/reviewing this code in some way. this is my first work since learning javascript so if you have any bugs reports/suggestions/improvements regarding my code, I'd super appreciate if you could share them with me!
also special thanks to dark forest legend phated (https://twitter.com/BlaineBublitz) and cristobal (https://github.com/cristobal).
blainebublitz has been super helpful in answering my questions, as he has generally always been to other dark forest coders lol. probably would've spent twice as long malding over how to check for bugs in chrome dev tools if he wasn't around
cristobal is the creator of the Custom Distribute Silver plugin (https://github.com/darkforest-eth/plugins/blob/master/content/productivity/custom-distribute-silver/plugin.js). you may notice that a lot of code in this plugin has been "borrowed" from it. super clean code btw, much better than you'll see here
==================================================================
anyway here's some info regarding the actual plugin which will probably make it easier to follow along:
Trigger type corresponding numbers:
Energy - 0
Silver - 1
Spaceship - 2
Contains Artifact - 3
Artifact Status - 4
Action type corresponding numbers:
Move - 0
Upgrade - 1
Abandon - 2
Send Spaceship - 3
Activate/Deactivate Artifact - 4
triggerList format: [Trigger Type, Source Planet, Energy Req, Silver Req, Spaceship ID, Artifact ID, Artifact Status]
actionList format: [Action Type, Source Planet, Target Planet, Energy, Silver, Spaceship ID, Artifact ID, Artifact Status, Upgrade Type, deleteAfterExecuted?]
*/

//i have no idea what i'm importing lmao

import { PlanetType, SpaceType, PlanetTypeNames 
} from 'https://cdn.skypack.dev/@darkforest_eth/types'; 

import { isUnconfirmedMoveTx } from 'https://cdn.skypack.dev/@darkforest_eth/serde'; 

import { html, render, useEffect, useState, useLayoutEffect
} from 'https://unpkg.com/htm/preact/standalone.module.js';

import { getPlanetName } from 'https://cdn.skypack.dev/@darkforest_eth/procedural';

//in seconds
const TRIGGER_SCAN_COOLDOWN = 10;

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

//for adding activate triggers for displayment purposes
var addTrigger = (triggerType, actionType, source, target) => {
    const triggerTypeNames = ['Energy', 'Silver', 'Spaceship', 'Has Artifact', 'Artifact Status'];
    const actionTypeNames = ['Move', 'Upgrade', 'Abandon', 'Send Spaceship', 'Artifact Status'];
    const pairElement = document.createElement("span");
    pairElement.append(triggerTypeNames[triggerType] + ' || ' + actionTypeNames[actionType] + ' ');
    pairElement.append(planetLink(source));
    if (target && actionType != 1) {
    pairElement.append(' => ');
    pairElement.append(planetLink(target));
    }
    return pairElement;
}

class Plugin {

  constructor() {
    this.triggerType = 0;
    this.triggerPlanetSource = '';
    this.triggerEnergy = 0;
    this.triggerSilver = 0;
    this.triggerSpaceship = '';
    this.triggerArtifact = '';
    this.triggerArtifactStatus = true;
    this.actionType = 0;
    this.actionPlanetSource = '';
    this.planetTarget = '';
    this.actionEnergy = 0;
    this.actionSilver = 0;
    this.actionSpaceship = '';
    this.actionArtifact = '';
    this.actionArtifactStatus = true;
    this.actionUpgradeType = 0;
    this.triggerList = [];
    this.actionList = [];
    this.triggerScanMasterList = [this.triggerList, this.actionList];
    this.autoSeconds = TRIGGER_SCAN_COOLDOWN;
    this.deleteAfterExecuted = true;
  }
  
  
  renderTriggerList(triggerListContainer) {
    removeAllChildNodes(triggerListContainer);
    
    for (const item of this.triggerScanMasterList[0]) {
      const pairElement = addTrigger(item[0], this.triggerScanMasterList[1][this.triggerScanMasterList[0].indexOf(item)][0], item[1], this.triggerScanMasterList[1][this.triggerScanMasterList[0].indexOf(item)][2]);
      triggerListContainer.append(pairElement);

      // deleteButton for remove pair from the list
      const delButton = document.createElement("button");
      triggerListContainer.append(delButton);
      delButton.innerText = "Del";
      delButton.style.marginLeft = "10px";
      delButton.addEventListener("click", () => {
        for (let i=0; i<this.triggerScanMasterList[0].length; i++) {
          if (this.triggerScanMasterList[0][i][1] == item[1] && this.triggerScanMasterList[1][i][2] == this.triggerScanMasterList[1][this.triggerScanMasterList[0].indexOf(item)][2]) {
            this.triggerScanMasterList[0].splice(i, 1);
            this.triggerScanMasterList[1].splice(i, 1);
            break;
          }
          else {
          console.log("trigger unsuccessfully deleted: " + this.triggerScanMasterList[0][i][1] + " != " + item[1] + " or " + this.triggerScanMasterList[1][i][2] + " != " + this.triggerScanMasterList[1][this.triggerScanMasterList[0].indexOf(item)][2]);
          }
        }
        this.renderTriggerList(triggerListContainer);
      });

      // new line
      const newLine = document.createElement("br");
      triggerListContainer.append(newLine);
    }
  }
  //loop through triggerList for fulfilled conditions and execute corresponding actions in actionList
  triggerCheckAndExecute() {
    console.log("looping through list");
    let conditionFulfilled = false;
    let executableActions = [];
    let currentTrigger = 0;
    for (const item of this.triggerScanMasterList[0]) {
    
    //setting names that make more sense for trigger attributes
      let currentTriggerType = item[0];
      let currentTriggerSource = item[1];
      let currentTriggerEnergy = item[2];
      let currentTriggerSilver = item[3];
      let currentTriggerSpaceship = item[4];
      let currentTriggerArtifact = item[5];
      let currentTriggerArtifactStatus = item[6];
      
      //figuring out what kind of trigger each trigger is and then  figuring out if thr trigger condition is fulfilled, then storing that information for the next action section
    if (isEnergyTrigger(currentTriggerType)) {
      conditionFulfilled = isEnergyConditionTrue(currentTriggerSource, currentTriggerEnergy);
    }
    else if (isSilverTrigger(currentTriggerType)) {
      conditionFulfilled = isSilverConditionTrue(currentTriggerSource, currentTriggerSilver);
    }
    else if (isSpaceshipTrigger(currentTriggerType)) {
      conditionFulfilled = isSpaceshipConditionTrue(currentTriggerSource, currentTriggerSpaceship);
    }
    else if (isContainsArtifactTrigger(currentTriggerType)) {
      conditionFulfilled = isContainsArtifactConditionTrue(currentTriggerSource, currentTriggerArtifact);
    }
    else if (isArtifactStatusTrigger(currentTriggerType)) {
      conditionFulfilled = isArtifactStatusConditionTrue(currentTriggerSource, currentTriggerArtifact, currentTriggerArtifactStatus);
    }
    else {
      console.log("you kinda suck at assigning trigger types");
    }
    if (conditionFulfilled) {
      executableActions.push(currentTrigger);
    }
    currentTrigger++;
  }
    for (let currentAction = 0; currentAction < executableActions.length; currentAction++) {
    
    //setting names that make more sense for action attributes
      let currentActionType = this.triggerScanMasterList[1][executableActions[currentAction]][0];
      let currentActionSource = this.triggerScanMasterList[1][executableActions[currentAction]][1];
      let currentActionTarget = this.triggerScanMasterList[1][executableActions[currentAction]][2];
      let currentActionEnergy = this.triggerScanMasterList[1][executableActions[currentAction]][3];
      let currentActionSilver = this.triggerScanMasterList[1][executableActions[currentAction]][4];
      let currentActionSpaceship = this.triggerScanMasterList[1][executableActions[currentAction]][5];
      let currentActionArtifact = this.triggerScanMasterList[1][executableActions[currentAction]][6];
      let currentActionArtifactStatus = this.triggerScanMasterList[1][executableActions[currentAction]][7];
      let currentActionUpgrade = this.triggerScanMasterList[1][executableActions[currentAction]][8];
      let deletable = this.triggerScanMasterList[1][executableActions[currentAction]][9];
      
      //figuring out what type of action each action is and then executing accordingly
      if (isMoveAction(currentActionType)) {
        df.move(currentActionSource, currentActionTarget, currentActionEnergy, currentActionSilver, currentActionArtifact);
        console.log('df.move(' + currentActionSource + ', ' + currentActionTarget + ', ' + currentActionEnergy + ', ' + currentActionSilver + ', ' + currentActionArtifact +')');
      }
      else if (isUpgradeAction(currentActionType)) {
      df.upgrade(currentActionSource, currentActionUpgrade);
      console.log('df.upgrade(' + currentActionSource + ', ' + currentActionUpgrade + ')');
      }
      else if (isAbandonAction(currentActionType)) {
        df.move(currentActionSource, currentActionTarget, 0, 0, currentActionArtifact, true);
        console.log('df.move(' + currentActionSource + ', ' + currentActionTarget + ', 0, 0, ' + currentActionArtifact + ', true)');
      }
      else if (isSpaceshipAction(currentActionType)) {
        df.move(currentActionSource, currentActionTarget, 0, 0, currentActionSpaceship);
        console.log('df.move(' + currentActionSource + ', ' + currentActionTarget + ', 0, 0, ' + currentActionArtifact + ')');
      }
      //checks if the artifact id in question is a wormhole, which is artifactType "5"
      else if (isArtifactStatusAction(currentActionType) && df.getArtifactWithId(currentActionArtifact).artifactType != 5) {
        if (currentActionArtifactStatus == 1) {
          df.activateArtifact(currentActionSource, currentActionArtifact);
          console.log('df.activateArtifact(' + currentActionSource + ', ' + currentActionArtifact + ')');
        }
        else {
          df.deactivateArtifact(currentActionSource, currentActionArtifact);
          console.log('df.deactivateArtifact(' + currentActionSource + ', ' + currentActionArtifact + ')');
        }
      }
      else if (isArtifactStatusAction(currentActionType) && df.getArtifactWithId(currentActionArtifact).artifactType == 5) {
        if (currentActionArtifactStatus == 1) {
          df.activateArtifact(currentActionSource, currentActionArtifact, currentActionTarget);
          console.log('df.activateArtifact(' + currentActionSource + ', ' + currentActionArtifact + ', ' + currentActionTarget + ')');
        }
        else {
          df.deactivateArtifact(currentActionSource, currentActionArtifact);
          console.log('df.deactivateArtifact(' + currentActionSource + ', ' + currentActionArtifact + ')');
        }
      }
      else {
        console.log("you kinda suck at assigning action conditions");
      }
      if (deletable) {
this.triggerScanMasterList[0].splice(executableActions[currentAction], 1);
        this.triggerScanMasterList[1].splice(executableActions[currentAction], 1);
      }
    else {
      if (deletable) {
      console.log('action was deletable but looks like a separate problem is present');
      }
      else {
      console.log('action was not deletable');
      }
      }
    } 
  }

  /**
   * Called when plugin is launched with the "run" button.
   */
  render(container) {
    container.parentElement.style.minHeight = 'unset';
    container.style.minHeight = 'unset';
    container.style.width = '645px';
    
    // addButton for append pair to the list
    const addButton = document.createElement("button");
    addButton.innerText = "Add Trigger to List";
    addButton.style.marginRight = "10px";
    addButton.addEventListener("click", () => {
      /*if (this.actionType == 4 && this.actionArtifact.artifactType != 5) {
        this.planetTarget = 'None';
      }*/
      this.triggerList = [this.triggerType, this.triggerPlanetSource, this.triggerEnergy, this.triggerSilver, this.triggerSpaceship, this.triggerArtifact, this.triggerArtifactStatus];
      if (this.actionType == 1 || this.actionType == 4) {
        this.actionList = [this.actionType, this.actionPlanetSource, this.planetTarget, this.actionEnergy, this.actionSilver, this.actionSpaceship, this.actionArtifact, this.actionArtifactStatus, this.actionUpgradeType, this.deleteAfterExecuted];
      }
      else {
      this.actionList = [this.actionType, this.actionPlanetSource, this.planetTarget, Math.ceil(df.getEnergyNeededForMove(this.actionPlanetSource, this.planetTarget, this.actionEnergy)), this.actionSilver, this.actionSpaceship, this.actionArtifact, this.actionArtifactStatus, this.actionUpgradeType, this.deleteAfterExecuted];
      }
      this.triggerScanMasterList[0].splice(0, 0, this.triggerList);
      this.triggerScanMasterList[1].splice(0, 0, this.actionList);
      this.renderTriggerList(triggerListContainer);
    });
    
    //trigger type container
    //also ctrl+f "triggerTypeContainer.onchange" to find how changing the select element values influences the actual trigger values because order mattered when programming this :/
    const triggerTypeContainer = document.createElement("SELECT");
    triggerTypeContainer.style.marginRight = "10px";
    triggerTypeContainer.style.background = 'rgb(8,8,8)';
    
    //trigger options and attribute setting
    const triggerEnergyOption = document.createElement("option");
    const triggerSilverOption = document.createElement("option");
    const triggerSpaceshipOption = document.createElement("option");
    const triggerContainsArtifactOption = document.createElement("option");
    const triggerArtifactStatusOption = document.createElement("option");
    
    triggerEnergyOption.innerHTML = "Energy";
    triggerSilverOption.innerHTML = "Silver";
    triggerSpaceshipOption.innerHTML = "Contains Spaceship";
    triggerContainsArtifactOption.innerHTML = "Contains Artifact";
    triggerArtifactStatusOption.innerHTML = "Artifact Status";
    
    triggerEnergyOption.setAttribute("type", "number");
    triggerSilverOption.setAttribute("type", "number");
    triggerSpaceshipOption.setAttribute("type", "number");
    triggerContainsArtifactOption.setAttribute("type", "number");
    triggerArtifactStatusOption.setAttribute("type", "number");
    
    triggerEnergyOption.setAttribute("value", 0);
    triggerSilverOption.setAttribute("value", 1);
    triggerSpaceshipOption.setAttribute("value", 2);
    triggerContainsArtifactOption.setAttribute("value", 3);
    triggerArtifactStatusOption.setAttribute("value", 4);
    
    triggerEnergyOption.setAttribute("id", "triggerEnergy");
    triggerSilverOption.setAttribute("id", "triggerSilver");
    triggerSpaceshipOption.setAttribute("id", "triggerSpaceship");
    triggerContainsArtifactOption.setAttribute("id", "triggerContainsArtifact");
    triggerArtifactStatusOption.setAttribute("id", "triggerArtifactStatus");
    
    
    triggerTypeContainer.append(triggerEnergyOption, triggerSilverOption, triggerSpaceshipOption, triggerContainsArtifactOption, triggerArtifactStatusOption);
    
    //source display
    const triggerSourcePlanetContainer = document.createElement("div");
    triggerSourcePlanetContainer.innerText = "Current trigger source: none";
    
    const actionSourcePlanetContainer = document.createElement("div");
    actionSourcePlanetContainer.innerText = "Current action source: none";
    
    // button for adding a trigger source
    const addTriggerPlanetSourceButton = document.createElement("button");
    addTriggerPlanetSourceButton.innerText = "Add trigger source";
    addTriggerPlanetSourceButton.style.marginRight = "10px";
    addTriggerPlanetSourceButton.addEventListener("click", () => {
      removeAllChildNodes(triggerSourcePlanetContainer);
      const sourceTriggerPlanet = ui.getSelectedPlanet();
      if (sourceTriggerPlanet) {
          this.triggerPlanetSource = sourceTriggerPlanet.locationId;
      }
      // make the planet either be "none" when nothing is selected, or the planet link.
      triggerSourcePlanetContainer.append("Current trigger source: ", sourceTriggerPlanet ? planetLink(sourceTriggerPlanet.locationId) : "none");
    });
    
    //energy trigger input
    const triggerEnergyInput = document.createElement("input");
    triggerEnergyInput.style.marginRight = "10px";
    triggerEnergyInput.style.background = 'rgb(8,8,8)';
    triggerEnergyInput.setAttribute("type", "number");
    triggerEnergyInput.onchange = () => {
      this.triggerEnergy = triggerEnergyInput.value;
    }
    
    //silver trigger input
    const triggerSilverInput = document.createElement("input");
    triggerSilverInput.style.marginRight = "10px";
    triggerSilverInput.style.background = 'rgb(8,8,8)';
    triggerSilverInput.setAttribute("type", "number");
    triggerSilverInput.onchange = () => {
      this.triggerSilver = triggerSilverInput.value;
    }
    
    //contains spaceship trigger input
    const triggerSpaceshipInput = document.createElement("input");
    triggerSpaceshipInput.style.marginRight = "10px";
    triggerSpaceshipInput.style.background = 'rgb(8,8,8)';
    triggerSpaceshipInput.setAttribute("type", "text");
    triggerSpaceshipInput.onchange = () => {
      this.triggerSpaceship = triggerSpaceshipInput.value;
    }
    
    //contains artifact trigger input
    const triggerArtifactInput = document.createElement("input");
    triggerArtifactInput.style.marginRight = "10px";
    triggerArtifactInput.style.background = 'rgb(8,8,8)';
    triggerArtifactInput.setAttribute("type", "text");
    triggerArtifactInput.onchange = () => {
      this.triggerArtifact = triggerArtifactInput.value;
    }
    
    //artifact status trigger input
    const triggerArtifactStatusInput = document.createElement("SELECT");
    triggerArtifactStatusInput.style.marginRight = "10px";
    triggerArtifactStatusInput.style.background = 'rgb(8,8,8)';
    const triggerArtifactStatusTrue = document.createElement("option");
    const triggerArtifactStatusFalse = document.createElement("option");
    triggerArtifactStatusTrue.innerHTML = "Activated";
    triggerArtifactStatusFalse.innerHTML = "Deactivated";
    triggerArtifactStatusTrue.setAttribute("type", "boolean");
    triggerArtifactStatusFalse.setAttribute("type", "boolean");
    triggerArtifactStatusTrue.setAttribute("value", true);
    triggerArtifactStatusFalse.setAttribute("value", false);
    triggerArtifactStatusInput.append(triggerArtifactStatusTrue, triggerArtifactStatusFalse);
    triggerArtifactStatusInput.onchange = () => {
      this.triggerArtifactStatus = triggerArtifactStatusInput.value;
    }
    
    //action type container
    //same thing with the triggerTypeContainer, ctrl+f "actionTypeContainer.onchange" to find how changing the select element values influences the actual trigger values
    const actionTypeContainer = document.createElement("SELECT");
    actionTypeContainer.style.marginRight = "10px";
    actionTypeContainer.style.background = 'rgb(8,8,8)';
    
    //action options and attribute setting
    const actionMoveOption = document.createElement("option");
    const actionUpgradeOption = document.createElement("option");
    const actionAbandonOption = document.createElement("option");
    const actionSpaceshipOption = document.createElement("option");
    const actionArtifactStatusOption = document.createElement("option");
    
    actionMoveOption.innerHTML = "Move";
    actionUpgradeOption.innerHTML = "Upgrade";
    actionAbandonOption.innerHTML = "Abandon";
    actionSpaceshipOption.innerHTML = "Send Spaceship";
    actionArtifactStatusOption.innerHTML = "Activate/Deactivate Artifact";
    
    actionMoveOption.setAttribute("type", "number");
    actionUpgradeOption.setAttribute("type", "number");
    actionAbandonOption.setAttribute("type", "number");
    actionSpaceshipOption.setAttribute("type", "number");
    actionArtifactStatusOption.setAttribute("type", "number");
    
    actionMoveOption.setAttribute("value", 0);
    actionUpgradeOption.setAttribute("value", 1);
    actionAbandonOption.setAttribute("value", 2);
    actionSpaceshipOption.setAttribute("value", 3);
    actionArtifactStatusOption.setAttribute("value", 4);
    
    
    
    /*actionEnergyOption.setAttribute("id", "actionEnergy");
    actionSilverOption.setAttribute("id", "actionSilver");
    actionSpaceshipOption.setAttribute("id", "actionSpaceship");
    actionContainsArtifactOption.setAttribute("id", "actionContainsArtifact");
    actionArtifactStatusOption.setAttribute("id", "actionArtifactStatus");*/
    
    
    actionTypeContainer.append(actionMoveOption, actionUpgradeOption, actionAbandonOption, actionSpaceshipOption, actionArtifactStatusOption);
    
    //button for adding an action source
    const addActionPlanetSourceButton = document.createElement("button");
    addActionPlanetSourceButton.innerText = "Add action source";
    addActionPlanetSourceButton.style.marginRight = "10px";
    addActionPlanetSourceButton.addEventListener("click", () => {
      removeAllChildNodes(actionSourcePlanetContainer);
      const sourceActionPlanet = ui.getSelectedPlanet();
      if (sourceActionPlanet) {
          this.actionPlanetSource = sourceActionPlanet.locationId;
      }
      // make the planet either be "none" when nothing is selected, or the planet link.
      actionSourcePlanetContainer.append("Current action source: ", sourceActionPlanet ? planetLink(sourceActionPlanet.locationId) : "none");
    });
    
    // target display
    const targetPlanetContainer = document.createElement("div");
    targetPlanetContainer.innerText = "Current target: none";
    // button for adding an target
    const addPlanetTargetButton = document.createElement("button");
    addPlanetTargetButton.innerText = "Add target";
    addPlanetTargetButton.style.marginRight = "10px";
    addPlanetTargetButton.addEventListener("click", () => {
      removeAllChildNodes(targetPlanetContainer);
      const targetedPlanet = ui.getSelectedPlanet();
      if (targetedPlanet) {
          this.planetTarget = targetedPlanet.locationId;
      }
      // make the planet either be "none" when nothing is selected, or the planet link.
      targetPlanetContainer.append("Current target: ", targetedPlanet ? planetLink(targetedPlanet.locationId) : "none");
    });
    
    //energy action input
    const actionEnergyInput = document.createElement("input");
    actionEnergyInput.style.marginRight = "10px";
    actionEnergyInput.style.background = 'rgb(8,8,8)';
    actionEnergyInput.setAttribute("type", "number");
    actionEnergyInput.onchange = () => {
      this.actionEnergy = actionEnergyInput.value;
    }
    
    //silver action input
    const actionSilverInput = document.createElement("input");
    actionSilverInput.style.marginRight = "10px";
    actionSilverInput.style.background = 'rgb(8,8,8)';
    actionSilverInput.setAttribute("type", "number");
    actionSilverInput.onchange = () => {
      this.actionSilver = actionSilverInput.value;
    }
    
    //contains spaceship action input
    const actionSpaceshipInput = document.createElement("input");
    actionSpaceshipInput.style.marginRight = "10px";
    actionSpaceshipInput.style.background = 'rgb(8,8,8)';
    actionSpaceshipInput.setAttribute("type", "text");
    actionSpaceshipInput.onchange = () => {
      this.actionSpaceship = actionSpaceshipInput.value;
    }
    
    //contains artifact action input
    const actionArtifactInput = document.createElement("input");
    actionArtifactInput.style.marginRight = "10px";
    actionArtifactInput.style.background = 'rgb(8,8,8)';
    actionArtifactInput.setAttribute("type", "text");
    actionArtifactInput.onchange = () => {
      this.actionArtifact = actionArtifactInput.value;
    }
    
    //artifact status action input
    const actionArtifactStatusInput = document.createElement("SELECT");
    actionArtifactStatusInput.style.marginRight = "10px";
    actionArtifactStatusInput.style.background = 'rgb(8,8,8)';
    const actionArtifactStatusTrue = document.createElement("option");
    const actionArtifactStatusFalse = document.createElement("option");
    actionArtifactStatusTrue.innerHTML = "Activate";
    actionArtifactStatusFalse.innerHTML = "Deactivate";
    actionArtifactStatusTrue.setAttribute("type", "boolean");
    actionArtifactStatusFalse.setAttribute("type", "boolean");
    actionArtifactStatusTrue.setAttribute("value", true);
    actionArtifactStatusFalse.setAttribute("value", false);
    actionArtifactStatusInput.append(actionArtifactStatusTrue, actionArtifactStatusFalse);
    actionArtifactStatusInput.onchange = () => {
      this.actionArtifactStatus = actionArtifactStatusInput.value;
    }
    
    //upgrade type action input
    const actionUpgradeTypeInput = document.createElement("SELECT");
    actionUpgradeTypeInput.style.marginRight = "10px";
    actionUpgradeTypeInput.style.background = 'rgb(8,8,8)';
    const defenseTypeOption = document.createElement("option");
    const rangeTypeOption = document.createElement("option");
    const speedTypeOption = document.createElement("option");
    defenseTypeOption.innerHTML = "Defense";
    rangeTypeOption.innerHTML = "Range";
    speedTypeOption.innerHTML = "Speed";
    defenseTypeOption.setAttribute("type", "number");
    rangeTypeOption.setAttribute("type", "number");
    speedTypeOption.setAttribute("type", "number");
    defenseTypeOption.setAttribute("value", 0);
    rangeTypeOption.setAttribute("value", 1);
    speedTypeOption.setAttribute("value", 2);
    actionUpgradeTypeInput.append(defenseTypeOption, rangeTypeOption, speedTypeOption);
    actionUpgradeTypeInput.onchange = () => {
      this.actionUpgradeType = actionUpgradeTypeInput.value;
    }
    
    // button to loop through all triggers
    let globalButton = document.createElement('button');
    globalButton.style.width = '100%';
    globalButton.style.marginBottom = '10px';
    globalButton.innerHTML = 'Check Triggers'
    globalButton.addEventListener("click", () => {
      this.triggerCheckAndExecute();
    });
    
    // stuff managing intervals between auto loops
    let autoSecondsStepper = document.createElement('input');
    autoSecondsStepper.type = 'range';
    autoSecondsStepper.min = '1';
    autoSecondsStepper.max = '60';
    autoSecondsStepper.step = '1';
    autoSecondsStepper.value = `${this.autoSeconds}`;
    autoSecondsStepper.style.width = '100%';
    autoSecondsStepper.style.height = '24px';

    let autoSecondsInfo = document.createElement('span');
    autoSecondsInfo.innerText = `Check Triggers Every ${autoSecondsStepper.value} seconds`;
    autoSecondsInfo.style.display = 'block';
    autoSecondsInfo.style.marginTop = '10px';

    autoSecondsStepper.onchange = (evt) => {
      try {
        this.autoSeconds = parseInt(evt.target.value, 10);
        autoSecondsInfo.innerText = `Check Triggers Every ${autoSecondsStepper.value} seconds`;
      } catch (e) {
        console.error('could not parse auto seconds', e);
      }
    }
    
    this.timerId = setInterval(() => {
          setTimeout(this.triggerCheckAndExecute(), 0);
          this.renderTriggerList(triggerListContainer);
        }, 1000 * this.autoSeconds)
    
    const triggerListContainerLabel = document.createElement("div");
    triggerListContainerLabel.innerText = "Trigger list:";
    
    const triggerListContainer = document.createElement("div");
      triggerListContainer.style.marginTop = '10px';
      
      let deleteAfterExecutedButton = document.createElement('input');
    deleteAfterExecutedButton.type = "checkbox";
    deleteAfterExecutedButton.style.marginLeft = "410px";
    deleteAfterExecutedButton.checked = true;
    deleteAfterExecutedButton.onchange = () => {
      this.deleteAfterExecuted = deleteAfterExecutedButton.checked.value;
    }
    
    const triggerListContainerNewLine = document.createElement("div");
    triggerListContainerNewLine.innerText = "================================================================================";
    
    const pluginOverview = document.createElement("div");
    pluginOverview.innerText = "CLARIFYING INFO: A photoid cannon is considered Activated when its activation delay is complete. Sent Energy is the energy that arrives on a target planet, not the amount the origin planet uses.";
    const pluginOverviewBreak = document.createElement("p");
    pluginOverviewBreak.innerText = "================================================================================";
    const deleteOverviewButton = document.createElement("button");
    deleteOverviewButton.innerText = "Delete Info Section";
    deleteOverviewButton.style.marginLeft = "160px";
    deleteOverviewButton.addEventListener("click", () => {
      container.removeChild(pluginOverview);
    });
    pluginOverview.append(deleteOverviewButton, pluginOverviewBreak);
    container.appendChild(pluginOverview);
    
    const triggersNewLine = document.createElement("br");
    const actionsNewLine = document.createElement("br");
    const globalButtonNewLine = document.createElement("br");
    
    const triggersDescription1 = document.createElement("div");
    const triggerTypeDescription = document.createElement("text");
    triggerTypeDescription.innerText = "Trigger Type:";
    const triggerEnergyDescription = document.createElement("text");
    triggerEnergyDescription.innerText = "Energy Requirement:";
    triggerEnergyDescription.style.marginLeft = "70px";
    const triggerSilverDescription = document.createElement("text");
    triggerSilverDescription.innerText = "Silver Requirement:";
    triggerSilverDescription.style.marginLeft = "25px";
    triggersDescription1.append(triggerTypeDescription, triggerEnergyDescription, triggerSilverDescription);
    
    const triggersDescription2 = document.createElement("div");
    const triggerSpaceshipDescription = document.createElement("text");
    triggerSpaceshipDescription.innerText = "Spaceship ID:";
    const triggerArtifactDescription = document.createElement("text");
    triggerArtifactDescription.innerText = "Artifact ID:";
    triggerArtifactDescription.style.marginLeft = "70px";
    const triggerArtifactStatusDescription = document.createElement("text");
    triggerArtifactStatusDescription.innerText = "Artifact Status:";
    triggerArtifactStatusDescription.style.marginLeft = "80px";
    triggersDescription2.append(triggerSpaceshipDescription, triggerArtifactDescription, triggerArtifactStatusDescription);
    
    const actionsDescription1 = document.createElement("div");
    const actionTypeDescription = document.createElement("text");
    actionTypeDescription.innerText = "Action Type:";
    const actionEnergyDescription = document.createElement("text");
    actionEnergyDescription.innerText = "Sent Energy:";
    actionEnergyDescription.style.marginLeft = "160px";
    const actionSilverDescription = document.createElement("text");
    actionSilverDescription.innerText = "Sent Silver:";
    actionSilverDescription.style.marginLeft = "75px";
    actionsDescription1.append(actionTypeDescription, actionEnergyDescription, actionSilverDescription);
    
    const actionsDescription2 = document.createElement("div");
    const actionSpaceshipDescription = document.createElement("text");
    actionSpaceshipDescription.innerText = "Sent Spaceship ID:";
    const actionArtifactDescription = document.createElement("text");
    actionArtifactDescription.innerText = "Artifact ID:";
    actionArtifactDescription.style.marginLeft = "35px";
    const actionArtifactStatusDescription = document.createElement("text");
    actionArtifactStatusDescription.innerText = "New Artifact Status:";
    actionArtifactStatusDescription.style.marginLeft = "70px";
    actionsDescription2.append(actionSpaceshipDescription, actionArtifactDescription, actionArtifactStatusDescription);
    
    const actionsDescription3 = document.createElement("div");
    const actionUpgradeTypeDescription = document.createElement("text");
    actionUpgradeTypeDescription.innerText = "Upgrade Type:";
    const deletableAction = document.createElement("text");
    deletableAction.innerText = "Delete After Executed?";
    deletableAction.style.marginLeft = "315px";
    actionsDescription3.append(actionUpgradeTypeDescription, deletableAction);
    
    const actionUpgradeTypeDeletableContainer = document.createElement("div");
  actionUpgradeTypeDeletableContainer.append(actionUpgradeTypeInput, deleteAfterExecutedButton);
  
        triggerEnergyInput.disabled = false;
        triggerSilverInput.disabled = true;
        triggerSpaceshipInput.disabled = true;
        triggerArtifactInput.disabled = true;
        triggerArtifactStatusInput.disabled = true;
        
        addPlanetTargetButton.disabled = false;
        actionEnergyInput.disabled = false;
        actionSilverInput.disabled = false;
        actionSpaceshipInput.disabled = true;
        actionArtifactInput.disabled = false;
        actionArtifactStatusInput.disabled = true;
        actionUpgradeTypeInput.disabled = true;
        
        //you should be seeing this if you either 'ctrl+f'ed "triggerTypeContainer.onchange" or "actionTypeContainer.onchange"
  triggerTypeContainer.onchange = () => {
    this.triggerType = triggerTypeContainer.value;
      if (this.triggerType == 0) {
        triggerEnergyInput.disabled = false;
        triggerSilverInput.disabled = true;
        triggerSpaceshipInput.disabled = true;
        triggerArtifactInput.disabled = true;
        triggerArtifactStatusInput.disabled = true;
      }
      else if (this.triggerType == 1) {
        triggerEnergyInput.disabled = true;
        triggerSilverInput.disabled = false;
        triggerSpaceshipInput.disabled = true;
        triggerArtifactInput.disabled = true;
        triggerArtifactStatusInput.disabled = true;
      }
      else if (this.triggerType == 2) {
        triggerEnergyInput.disabled = true;
        triggerSilverInput.disabled = true;
        triggerSpaceshipInput.disabled = false;
        triggerArtifactInput.disabled = true;
        triggerArtifactStatusInput.disabled = true;
      }
      else if (this.triggerType == 3) {
        triggerEnergyInput.disabled = true;
        triggerSilverInput.disabled = true;
        triggerSpaceshipInput.disabled = true;
        triggerArtifactInput.disabled = false;
        triggerArtifactStatusInput.disabled = true;
      }
      else if (this.triggerType == 4) {
        triggerEnergyInput.disabled = true;
        triggerSilverInput.disabled = true;
        triggerSpaceshipInput.disabled = true;
        triggerArtifactInput.disabled = false;
        triggerArtifactStatusInput.disabled = false;
      }
    }
    
    //you should be seeing this if you either 'ctrl+f'ed "triggerTypeContainer.onchange" or "actionTypeContainer.onchange"
    actionTypeContainer.onchange = () => {
      this.actionType = actionTypeContainer.value;
      if (this.actionType == 0) {
        addPlanetTargetButton.disabled = false;
        actionEnergyInput.disabled = false;
        actionSilverInput.disabled = false;
        actionSpaceshipInput.disabled = true;
        actionArtifactInput.disabled = false;
        actionArtifactStatusInput.disabled = true;
        actionUpgradeTypeInput.disabled = true;
      }
      else if (this.actionType == 1) {
        addPlanetTargetButton.disabled = true;
        actionEnergyInput.disabled = true;
        actionSilverInput.disabled = true;
        actionSpaceshipInput.disabled = true;
        actionArtifactInput.disabled = true;
        actionArtifactStatusInput.disabled = true;
        actionUpgradeTypeInput.disabled = false;
      }
      else if (this.actionType == 2) {
        addPlanetTargetButton.disabled = false;
        actionEnergyInput.disabled = true;
        actionSilverInput.disabled = true;
        actionSpaceshipInput.disabled = true;
        actionArtifactInput.disabled = false;
        actionArtifactStatusInput.disabled = true;
        actionUpgradeTypeInput.disabled = true;
      }
      else if (this.actionType == 3) {
        addPlanetTargetButton.disabled = false;
        actionEnergyInput.disabled = true;
        actionSilverInput.disabled = true;
        actionSpaceshipInput.disabled = false;
        actionArtifactInput.disabled = true;
        actionArtifactStatusInput.disabled = true;
        actionUpgradeTypeInput.disabled = true;
      }
      else if (this.actionType == 4) {
        addPlanetTargetButton.disabled = false;
        actionEnergyInput.disabled = true;
        actionSilverInput.disabled = true;
        actionSpaceshipInput.disabled = true;
        actionArtifactInput.disabled = false;
        actionArtifactStatusInput.disabled = false;
        actionUpgradeTypeInput.disabled = true;
      }
    }

      container.appendChild(triggerSourcePlanetContainer);
      container.appendChild(actionSourcePlanetContainer);
      container.appendChild(targetPlanetContainer);
      container.appendChild(addTriggerPlanetSourceButton);
      container.appendChild(addActionPlanetSourceButton);
      container.appendChild(addPlanetTargetButton);
      container.appendChild(addButton);
      container.appendChild(triggersNewLine);
      container.appendChild(triggersDescription1);
      container.appendChild(triggerTypeContainer);
      container.appendChild(triggerEnergyInput);
      container.appendChild(triggerSilverInput);
      container.appendChild(triggersDescription2);
      container.appendChild(triggerSpaceshipInput);
      container.appendChild(triggerArtifactInput);
      container.appendChild(triggerArtifactStatusInput);
      container.appendChild(actionsNewLine);
      container.appendChild(actionsDescription1);
      container.appendChild(actionTypeContainer);
      container.appendChild(actionEnergyInput);
      container.appendChild(actionSilverInput);
      container.appendChild(actionsDescription2);
      container.appendChild(actionSpaceshipInput);
      container.appendChild(actionArtifactInput);
      container.appendChild(actionArtifactStatusInput);
      container.appendChild(actionsDescription3);
      container.appendChild(actionUpgradeTypeDeletableContainer);
      container.appendChild(globalButtonNewLine);
      container.appendChild(globalButton);
      container.appendChild(autoSecondsInfo);
      container.appendChild(autoSecondsStepper);
      container.appendChild(triggerListContainerLabel);
      container.appendChild(triggerListContainer);
    }

  /**
   * Called when plugin modal is closed.
   */
  destroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }
}

//trigger type detection
function isEnergyTrigger(triggerType) {
  return triggerType == 0;
}

function isSilverTrigger(triggerType) {
  return triggerType == 1;
}

function isSpaceshipTrigger(triggerType) {
  return triggerType == 2;
}

function isContainsArtifactTrigger(triggerType) {
  return triggerType == 3;
}

function isArtifactStatusTrigger(triggerType) {
  return triggerType == 4;
}

//action type detection
function isMoveAction (actionType) {
  return actionType == 0;
}

function isUpgradeAction (actionType) {
  return actionType == 1;
}

function isAbandonAction (actionType) {
  return actionType == 2;
}

function isSpaceshipAction (actionType) {
  return actionType == 3;
}

function isArtifactStatusAction (actionType) {
  return actionType == 4;
}

//checks for if a trigger condition is fulfilled
function isEnergyConditionTrue (planet, energy) {
  return df.getPlanetWithId(planet).energy >= energy;
}

function isSilverConditionTrue (planet, silver) {
  return df.getPlanetWithId(planet).silver >= silver;
}

function isSpaceshipConditionTrue (planet, spaceship) {
  return planet == df.getArtifactWithId(spaceship).onPlanetId;
}

function isContainsArtifactConditionTrue (planet, artifact) {
  return planet == df.getArtifactWithId(artifact).onPlanetId;
}

function isArtifactStatusConditionTrue (planet, artifact, condition) {
    let status = false;
    //if the artifact is a photoid cannon
    if (df.getArtifactWithId(artifact).artifactType == 7) {
      if (Date.now() / 1000 - df.getArtifactWithId(artifact).lastActivated > df.contractConstants.PHOTOID_ACTIVATION_DELAY / 1000) {
      status = true;
      }
    }
    else if (df.getArtifactWithId(artifact).lastActivated - df.getArtifactWithId(artifact).lastDeactivated > 0) {
      status = true;
    }
    
  return planet == df.getArtifactWithId(artifact).onPlanetId && condition == status;
}

/**
 * And don't forget to export it!
 */
export default Plugin;
