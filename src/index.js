var fs = require('fs');
var request = require("request");
var cheerio = require("cheerio");
var moment = require("moment");
var AlexaSkill = require('./AlexaSkill');

var APP_ID = 'amzn1.ask.skill.0fdc78be-c6a1-462b-9cfc-c8c1e01aeb11';

var intentHandlersUS = {
    "GetEventsIntent": function (intent, session, response) {
        handleEventRequest(intent, response, 'US');
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("You can make a request like 'Ask event finder what's going on this weekend in Berlin?', or, you can say 'Exit!'... What can I help you with?", "What can I help you with?");
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        this.emit(':tell', speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        this.emit(':tell', speechOutput);
    }
};

var intentHandlersUK = {
    "GetEventsIntent": function (intent, session, response) {
        handleEventRequest(intent, response, 'UK');
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("You can make a request like 'Ask event finder what's going on this weekend in Berlin?', or, you can say 'Exit!'... What can I help you with?", "What can I help you with?");
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

var intentHandlersDE = {
    "GetEventsIntent": function (intent, session, response) {
        handleEventRequest(intent,response, 'DE');
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("Du kannst mich Sachen wie folgt fragen: 'Frag Event-Finder nach Events in Berlin!', oder, du kannst 'Ende!' sagen... Wie kann ich dir helfen?", "Wie kann ich dir helfen?");
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Auf Wiedersehen!";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Auf Wiedersehen!";
        response.tell(speechOutput);
    }
};

function handleEventRequest(intent, response, language) {
    var date = intent.slots.Date.value;

    helper.getAskHelmutEvents('Berlin', date, function(events) {
        var speechOutput = '';
        if(language !== 'DE'){
            speechOutput = "The top 3 picks for your weekend in Berlin are: ";
            for (var i = 0; i < events.length; i++) {
                speechOutput += 'On ' + moment.weekdays(events[i].weekday()) + ' \'' + events[i].title + ' at ' + events[i].location + '.';
            }
        } else {
            speechOutput = "Die Top 3 für dein Wochenende in Berlin: ";
            for (var i = 0; i < events.length; i++) {
                speechOutput += 'Am ' + moment.weekdays(events[i].weekday()) + ' \'' + events[i].title + '. Location: ' + events[i].location + '.';
            }
        }
        response.tell(speechOutput);
    }, function(errorFeedback){
        if(language !== 'DE'){
            response.tell('I couldn\'t find any results.');
        } else {
            response.tell('Ich konnte keine Ergebnisse finden.')
        }
    });
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    var skill = new AlexaSkill(APP_ID);

    AlexaSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
        response.tell('What can I help you with? Try it out like this: \'Ask event finder what\'s going on this weekend in Berlin!\'');
    }

    var locale = event.request.locale;
    moment.locale(locale);

    if (locale == 'en-GB'){
        skill.intentHandlers = intentHandlersUK;
    } else if (locale == 'de-DE') {
        skill.intentHandlers = intentHandlersDE;
    } else {
        skill.intentHandlers = intentHandlersUS;
    }

    skill.execute(event, context);
};

// --------------- Helper Functions  -----------------------

var helper = {

    // gives the user more information on their final choice
    giveDescription: function (context) {

        // get the speech for the child node
        var description = helper.getDescriptionForNode(context.attributes.currentNode);
        var message = description + ', ' + repeatWelcomeMessage;

        context.emit(':ask', message, message);
    },

    // logic to provide the responses to the yes or no responses to the main questions
    yesOrNo: function (context, reply) {

        // this is a question node so we need to see if the user picked yes or no
        var nextNodeId = helper.getNextNode(context.attributes.currentNode, reply);

        // error in node data
        if (nextNodeId == -1)
        {
            context.handler.state = states.STARTMODE;

            // the current node was not found in the nodes array
            // this is due to the current node in the nodes array having a yes / no node id for a node that does not exist
            context.emit(':tell', nodeNotFoundMessage, nodeNotFoundMessage);
        }

        // get the speech for the child node
        var message = helper.getSpeechForNode(nextNodeId);

        // have we made a decision
        if (helper.isAnswerNode(nextNodeId) === true) {

            // set the game state to description mode
            context.handler.state = states.DESCRIPTIONMODE;

            // append the play again prompt to the decision and speak it
            message = decisionMessage + ' ' + message + ' ,' + playAgainMessage;
        }

        // set the current node to next node we want to go to
        context.attributes.currentNode = nextNodeId;

        context.emit(':ask', message, message);
    },

    // gets the description for the given node id
    getDescriptionForNode: function (nodeId) {

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].node == nodeId) {
                return nodes[i].description;
            }
        }
        return descriptionNotFoundMessage + nodeId;
    },

    // returns the speech for the provided node id
    getSpeechForNode: function (nodeId) {

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].node == nodeId) {
                return nodes[i].message;
            }
        }
        return speechNotFoundMessage + nodeId;
    },

    // checks to see if this node is an choice node or a decision node
    isAnswerNode: function (nodeId) {

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].node == nodeId) {
                if (nodes[i].yes === 0 && nodes[i].no === 0) {
                    return true;
                }
            }
        }
        return false;
    },

    // gets the next node to traverse to based on the yes no response
    getNextNode: function (nodeId, yesNo) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].node == nodeId) {
                if (yesNo == "yes") {
                    return nodes[i].yes;
                }
                return nodes[i].no;
            }
        }
        // error condition, didnt find a matching node id. Cause will be a yes / no entry in the array but with no corrosponding array entry
        return -1;
    },

    // Recursively walks the node tree looking for nodes already visited
    // This method could be changed if you want to implement another type of checking mechanism
    // This should be run on debug builds only not production
    // returns false if node tree path does not contain any previously visited nodes, true if it finds one
    debugFunction_walkNode: function (nodeId) {

        // console.log("Walking node: " + nodeId);

        if( helper.isAnswerNode(nodeId) === true) {
            // found an answer node - this path to this node does not contain a previously visted node
            // so we will return without recursing further

            // console.log("Answer node found");
             return false;
        }

        // mark this question node as visited
        if( helper.debugFunction_AddToVisited(nodeId) === false)
        {
            // node was not added to the visited list as it already exists, this indicates a duplicate path in the tree
            return true;
        }

        // console.log("Recursing yes path");
        var yesNode = helper.getNextNode(nodeId, "yes");
        var duplicatePathHit = helper.debugFunction_walkNode(yesNode);

        if( duplicatePathHit === true){
            return true;
        }

        // console.log("Recursing no");
        var noNode = helper.getNextNode(nodeId, "no");
        duplicatePathHit = helper.debugFunction_walkNode(noNode);

        if( duplicatePathHit === true){
            return true;
        }

        // the paths below this node returned no duplicates
        return false;
    },

    // checks to see if this node has previously been visited
    // if it has it will be set to 1 in the array and we return false (exists)
    // if it hasnt we set it to 1 and return true (added)
    debugFunction_AddToVisited: function (nodeId) {

        if (visited[nodeId] === 1) {
            // node previously added - duplicate exists
            // console.log("Node was previously visited - duplicate detected");
            return false;
        }

        // was not found so add it as a visited node
        visited[nodeId] = 1;
        return true;
    },

    /** Gets the given album's review from Pitchfork.
     *  Calls the callbackfunction with the abstract of the review.
     */
    getAskHelmutEvents: function (city, date, callbackFunction, errorCallbackFunction) {
        var typeOfDate;
        // Convert the weekend date to something Moment.js can use
        if(date.indexOf('-WE') === 8) {
            date = moment(date.replace('-WE', ''));
            date.add(4, 'days');
            typeOfDate = 'weekend';
        } else {
            if(date[5] === 'W'){
                typeOfDate = 'week';
            } else if (date.length === 10) {
                typeOfDate = 'day';
            } else {
                typeOfDate = 'wholerange'
            }
            date = moment(date);
        }
        // Scrape https://askhelmut.com/lists/helmuts-list-berlin to find events for the given time
        // Scrape tutorial here: https://www.sitepoint.com/web-scraping-in-node-js/
        var prefix = 'http://pitchfork.com';
        request({
            uri: 'https://askhelmut.com/lists/helmuts-list-' + city,
        }, function(error, response, body) {
            try{
                var $ = cheerio.load(body);
                var days = $(".event-tile");
                var events = [];
                days.each(function(index, element) {
                    var loadedElement = cheerio.load(element);
                    var eventObject = JSON.parse(loadedElement(".event-tile__favorites")['0'].attribs['data-react-props']);
                    var eventDate = eventObject.tracking.resource.substr(8, 10);
                    if(eventDate.indexOf('-') === 4) {
                        eventDate = moment(eventObject.tracking.resource.substr(8, 10), 'YYYY-MM-DD');
                    } else {
                        eventDate = moment(eventObject.tracking.resource.substr(8, 10), 'DD-MM-YYYY');
                    }
                    // See if the given event takes place in the given timerange
                    if (typeOfDate === 'wholerange' || 
                        (typeOfDate === 'week' && eventDate.isBetween(date, date.clone().add(7, 'days'), null, '[)')) ||
                        (typeOfDate === 'weekend' && eventDate.isBetween(date, date.clone().add(1, 'days'), null, '[]')) || 
                        (typeOfDate === 'day' && date.isSame(eventDate))
                        ) {
                        console.log(eventDate);
                        // Replace all line breaks using a regular expression
                        eventObject.title = loadedElement(".event-tile-title.ellipsis").text().replace(/\n/g,'');
                        eventObject.location = loadedElement(".event-tile-info__venue-title").text().replace(/\n/g,'');
                        eventObject.date = eventDate;
                        events.push(eventObject);
                    }
                });

                // Now, sort the events you just received by how many people like them
                var sortedEvents = events.sort(function(a, b){
                    if(a.count < b.count) {
                        return 1;
                    } else if (a.count > b.count) {
                        return -1;
                    } else {
                        return 0;
                    }
                });

                callbackFunction(sortedEvents);
                
            } catch (error) {
                errorCallbackFunction(error);
            }
        });
    }
};