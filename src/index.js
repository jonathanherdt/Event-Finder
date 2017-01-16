var fs = require('fs');
var request = require("request");
var cheerio = require("cheerio");
var AlexaSkill = require('./AlexaSkill');

var APP_ID = 'amzn1.ask.skill.0fdc78be-c6a1-462b-9cfc-c8c1e01aeb11';

var intentHandlersUS = {
    "GetNewAlbumRatingIntent": function (intent, session, response) {
        handleAlbumRatingRequest(intent, response, 'US');
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("You can make a request like 'Ask album rating about Lemonade by Beyonce!', or, you can say 'Exit!'... What can I help you with?", "What can I help you with?");
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
    "GetNewAlbumRatingIntent": function (intent, session, response) {
        handleAlbumRatingRequest(intent, response, 'UK');
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("You can make a request like 'Ask album rating about Lemonade by Beyonce!', or, you can say 'Exit!'... What can I help you with?", "What can I help you with?");
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
    "GetNewAlbumRatingIntent": function (intent, session, response) {
        handleAlbumRatingRequest(intent,response, 'DE');
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("Du kannst mich Sachen wie folgt fragen: 'Frag Album-Bewerter nach Lemonade von Beyoncé!', oder, du kannst 'Ende!' sagen... Wie kann ich dir helfen?", "Wie kann ich dir helfen?");
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

function handleAlbumRatingRequest(intent, response, language) {
    var album = intent.slots.Album.value? intent.slots.Album.value : '';
    var artist = intent.slots.Artist.value? intent.slots.Artist.value : '';
    var albumAndArtist = album + ' ' + artist;

    helper.getAlbumRating(albumAndArtist, function(albumReview) {
        var speechOutput = '';
        if(language !== 'DE'){
            speechOutput = "Pitchfork rated " + album + " by " + artist + " at " + albumReview.rating + ". They wrote: " + albumReview.abstract;
        } else {
            speechOutput = 'Pitchfork hat ' + album + " von " + artist + " mit " + albumReview.rating + "bewertet. In der Zusammenfassung heißt es: <s xml:lang=\"en-US\">" + albumReview.abstract + "</s>";
        }
        response.tell(speechOutput);
    }, function(errorFeedback){
        if(language !== 'DE'){
            response.tell('I couldn\'t find a result for ' + album + ' by ' + artist + '.');
        } else {
            response.tell('Ich konnte keine Ergebnisse zu ' + album + ' von ' + artist + ' finden.')
        }
    });
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    var skill = new AlexaSkill(APP_ID);

    AlexaSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
        response.tell('Which album can I help you with? Try it out like this: \'Ask album rating about Lemonade by Beyonce!\'');
    }

    var locale = event.request.locale;

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
    getAlbumRating: function (artistAndAlbum, callbackFunction, errorCallbackFunction) {
        // Scrape http://pitchfork.com/search/?query=
        // to find out the rating for the given album
        // Scrape tutorial here: https://www.sitepoint.com/web-scraping-in-node-js/
        var prefix = 'http://pitchfork.com';
        request({
            uri: prefix + '/search/?query=' + artistAndAlbum,
        }, function(error, response, body) {
            try{
                var resultObject = JSON.parse(body.split('window.App=')[1].split(';</script>')[0]);
                var review = resultObject.context.dispatcher.stores.SearchStore.results.albumreviews.items[0];
                // Cut out HTML tags from the abstract
                review.abstract = review.abstract.replace(/<\/?[^>]+(>|$)/g, "");
                request({
                    uri: prefix + review.site_url
                }, function(error, response, body) {
                    var $ = cheerio.load(body);
                    review.rating = $(".score").html();
                    callbackFunction(review);
                });
            } catch (error) {
                errorCallbackFunction();
            }
        });
    }
};