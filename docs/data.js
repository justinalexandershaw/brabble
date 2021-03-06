"use strict";
(function() {

  window.addEventListener('load', init);
  
  var NUM_TEAMS = 12;

  var draftManager;
  var myRoster = [];

  function init() {
    // Message Passing API
    let channel = new BroadcastChannel('drafted');
    channel.addEventListener('message', (message) => {
			// TODO: Parse the position limits from data.settings
			let data = message.data;
      console.log(data);
      myRoster = data.roster;
      draftManager.draft(data.player);
      NUM_TEAMS = data.settings.maxPlayers;
      updateUI();
    });

    // Set buttons
    id('help').addEventListener('click', fetchStats);
    id('num-best').onchange = updateNumBest;
    
    // Decide if we should fetch new rankings or use local copy
    if (storageContainsKey('rankings')) {
      let rankings = getKey('rankings');
      draftManager = new DraftManager(rankings.players, rankings.numTeams);
      updateUI();
    } else {
      console.log('fetching new stats...');
      fetchStats();
    }
  }

  /**
   * Updates the number of best players to display and updates UI.
   */
  function updateNumBest() {
    let num = qs('#num-best option:checked').value;
    draftManager.setBest(num);
    updateUI();
  }

  /**
   * Fetches the current expert concensus rankings from FantasyPros.
   */
  function fetchStats() {
    let proxy = 'https://cors-anywhere.herokuapp.com/';
    let url = 'https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php';
    fetch(proxy + url)
      .then(checkStatus)
      .then(response => response.text())
      .then(parseData)
      .then(updateUI)
      .catch(error => console.log('Error: ' + error));
  }

  /**
   * Returns the response's result text if successful, otherwise
   * returns the rejected Promise result with an error status text.
   * @param {object} response - response to check for success/error
   * @return {object} - valid response if response was successful, otherwise
   * rejected Promise result
   */
  function checkStatus(response) {
    if (response.ok) {
      return response;
    } else {
      throw Error("Error in request: " + response.statusText);
    }
  }

  /**
   * Pulls the html out of the fetch response, parses out the player
   * data and formats the data in a JSON object.
   * https://gomakethings.com/getting-html-with-fetch-in-vanilla-js/
   * @param {object} data - the data to parse
   */
  function parseData(data) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(data, 'text/html');
    
    let rankings = {};
    rankings.date = doc.querySelector('h5 > time').textContent;
    rankings.concensus = doc.querySelector('.head-wrap > h5').textContent;
    rankings.scoring = 'half-point-ppr'; // Todo: Add scoring options
    rankings.numTeams = NUM_TEAMS;
    rankings.players = [];

    let imgPath = "https://images.fantasypros.com/images/nfl/players/250x250/";
    let playerList = doc.querySelectorAll('.player-row');
    for (let i = 0; i < playerList.length; i++) {
      let p = {};
      let player = playerList[i];
      let playerData = player.childNodes[2].firstChild;
      p.rnk = i + 1 + '';
      p.id = playerData.getAttribute('data-id');
      p.name = playerData.getAttribute('data-name');
      p.short = playerData.getAttribute('data-shortname');
      p.team = playerData.getAttribute('data-team');
      p.pos = playerData.getAttribute('data-position');
      p.posRnk = player.childNodes[5].textContent;
      p.bye = player.childNodes[7].textContent;
      p.best = player.childNodes[9].textContent;
      p.worst = player.childNodes[11].textContent;
      p.avg = player.childNodes[13].textContent;
      p.std = player.childNodes[15].textContent;
      p.src = imgPath + p.id + '.jpg';
      if (parseInt(p.bye) < 10) { // change '10' to 'BYE 10'
        p.bye = '0' + p.bye;
      }
      p.bye = 'BYE ' + p.bye;
      if (p.pos === 'DST') { // change 'Seattle Seahawks' to 'Seahawks D/ST'
        let defense = p.name.split(' ');
        p.name = defense[defense.length - 1] + ' D/ST';
        // TODO: Update the src attribute to the team logo.
      }
      rankings.players.push(p);
    }
    save('rankings', rankings); // save session storage
    draftManager = new DraftManager(rankings.players, rankings.numTeams);
    console.log(rankings);
  }

  /**
   * Updates the user interface with the best players available.
   */
  function updateUI() {
    let best = draftManager.getBestAvailable();
    let percentAgree = draftManager.getExpertConsensus();

    // Update the Best Available Table
    let table = id('best-available');
    table.innerHTML = ''; // clear the table
    for (let i = 0; i < best.length; i++) {
      let row = formatPlayer(best[i], percentAgree[i]);
      table.appendChild(row);
    }

    // Update my team
    let myTeam = id('my-team');
    myTeam.innerHTML = ''; // clear the table
    for (let i = 0; i < myRoster.length; i++) {
      let player = draftManager.getDraftedPlayer(myRoster[i]);
      let row = formatRoster(player);
      myTeam.appendChild(row);
    }

    // Update the pick number
    let pickInfo = draftManager.getPick();
    id('pick').textContent = pickInfo[0];
    id('overall').textContent = pickInfo[1];
  }

  /**
   * Returns an DOM object with formatted player data.
   * @param {object} player - The player object to render.
   * @param {object} - The DOM object to add to the list
   */
  function formatRoster(player) {
    let row = makeParent('li', '', [
      make('span', '', player.pos, ''),
      makeParentWithText('span', 'player-name', player.name, [
        make('span', 'player-team', player.team, '')
      ]),
      make('span', 'player-bye', player.bye, '')
    ]);
    return row;
  }

  /**
   * Returns a DOM object with formatted player data.
   * @param {object} data – the player object to populate row
   * @param {string} agree - percent of experts who agree with pick
   * @returns {object} – the DOM object to append to the table
   */
  function formatPlayer(data, agree) {
    let player = makeParent('li', '', [
      make('img', '', '', data.src),
      makeParent('div', 'player-information', [
        make('span', 'player-name', data.name, ''),
        makeParent('div', '', [
          make('span', 'player-position', data.pos, ''),
          make('span', 'player-team', data.team, ''),
          make('span', 'player-bye', data.bye, ''),
          make('span', 'player-status', data.posRnk, '')
        ])
      ]),
      makeParent('div', 'player-stat-1', [
        make('span', '', 'ECR', ''),
        make('span', '', data.rnk, '')
      ]),
      makeParent('div', 'player-stat-2', [
        make('span', '', 'AVG', ''),
        make('span', '', data.avg, '')
      ]),
      makeParent('div', 'player-stat-3', [
        make('span', '', 'STD DEV', ''),
        make('span', '', data.std, '')
      ]),
      // TODO: Add ADP
      makeParent('div', 'player-stat-big', [
        make('span', '', agree, ''),
        make('span', '', 'of experts agree', '')
      ])
    ]);
    player.addEventListener('click', function() {
      draftManager.draft(data.name);
      updateUI();
    })
    return player;
  }

  /**
   * Returns a DOM object with the given children.
   * @param {string} name - the name of the element
   * @param {string} className – the name of the class to add
   * @param {array} children - the array of child nodes
   * @returns {object} - the DOM object of the parent.
   */
  function makeParent(name, className, children) {
    let parent = gen(name);
    if (className.length > 0 ) {
      parent.classList.add(className);
    }
    for (let i = 0; i < children.length; i++) {
      parent.appendChild(children[i]);
    }
    return parent;
  }

   /**
   * Returns a DOM object with the given children.
   * @param {string} name - the name of the element
   * @param {string} className – the name of the class to add
   * @param {string} text - the textContent to add to element
   * @param {array} children - the array of child nodes
   * @returns {object} - the DOM object of the parent.
   */
  function makeParentWithText(name, className, text, children) {
    let parent = makeParent(name, className, children);
    parent.textContent = text;
    return parent;
  }

  /**
   * Returns a DOM object with the given attributes.
   * @param {string} name - the name of the element
   * @param {string} className - the class to add to element
   * @param {string} text - the textContent to add to element
   * @param {string} src - the element's src attribute
   * @returns {object} - the DOM span object
   */
  function make(name, className, text, src) {
    let element = gen(name);
    if (className.length > 0) {
      element.classList.add(className);
    }
    if (text.length > 0) {
      element.textContent = text;
    }
    if (src.length > 0) {
      element.src = src;
      element.onerror = () => element.src = "https://images.fantasypros.com/images/photo_missing_square.jpg";
    }
    return element;
  } 
  

  /**
   * Returns the element with the specified ID attribute.
   * @param {string} name - element ID.
   * @returns {object} - DOM object associated with id.
   */
  function id(name) {
    return document.getElementById(name);
  }

  /**
   * Returns first element matching selector.
   * @param {string} selector - CSS query selector.
   * @returns {object} - DOM object associated selector.
   */
  function qs(selector) {
    return document.querySelector(selector);
  }

  /**
   * Generates a new element with the given tag.
   * @param {string} name – the name of the element
   * @returns {object} – the DOM object created
   */
  function gen(name) {
    return document.createElement(name);
  }

  /**
   * Saves the object as a string to session storage with the associated key.
   * @param {string} key - the name of the saved data
   * @param {object} object - the thing to save
   */
  function save(key, object) {
    window.sessionStorage.setItem(key, JSON.stringify(object));
  }

  /**
   * Returns the item associated with the given key.
   * @param {string} key - the key associated with the desired item
   */
  function getKey(key) {
    return JSON.parse(sessionStorage.getItem(key));
  }

  /**
   * Returns true if the session storage contains the given key
   * @param {string} key - the key associated with the given data
   */
  function storageContainsKey(key) {
    return window.sessionStorage.getItem(key) !== null;
  }

})();