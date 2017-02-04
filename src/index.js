var fs = require('fs');
var request = require("request");
var cheerio = require("cheerio");
var Alexa = require('alexa-app');

var app = new Alexa.app('eventfinder');

var helpAndLaunchFunction = function (request, response) {
    console.log(request);
    var prompt, reprompt;
    if(request.locale === 'de-DE') {
        reprompt = 'Mit Events für welche Stadt kann ich dir helfen?';
        prompt = "Du kannst mich Sachen wie folgt fragen: 'Frag Event-Finder nach Events in Berlin an diesem Wochenende!', oder, du kannst 'Ende!' sagen... Wie kann ich dir helfen?";
    } else {
        reprompt = 'Which city do you want to get events for?';
        prompt = "You can make a request like 'Ask event finder what's going on this weekend in Berlin?', or, you can say 'Exit!'... What can I help you with?";
    }
    response.say(prompt).reprompt(reprompt).shouldEndSession(false).send();
}

app.launch(helpAndLaunchFunction);

app.intent('AMAZON.HelpIntent', helpAndLaunchFunction);

var exitFunction = function (request, response) {
    var speechOutput;
    if(request.locale === 'de-DE') {
        speechOutput = 'Auf Wiedersehen!';
    } else {
        speechOutput = 'Goodbye';
    }

    response.say(speechOutput).send();
}

app.intent('AMAZON.StopIntent', exitFunction);
app.intent('AMAZON.CancelIntent', exitFunction);

app.intent('GetEventsIntent', {
        'slots': {
            'Date': 'AMAZON.Date',
            'City': 'AMAZON.DE_CITY'
        },
        // German
        'utterances': ['Frag Event-Finder nach Events in {-|City} an {-|Date}',
            'Frag Event-Finder nach Events in {-|City}']
        // English
        // 'utterances': ['{|tell me|what is} {|Pitchfork\'s|the} album rating of {-|Album} {by|from} {-|Artist}',
        // '{-|Album} by {-|Artist}']
    },
    function (request, response) {
        console.log(request);
        handleEventRequest(request, response);
        // Gotta return false because we handle the response asynchronously
        return false;
    }
)

function handleEventRequest(request, response) {
    var date = request.slots.Date.value;

    helper.getAskHelmutEvents('Berlin', date, function(events) {
        var speechOutput = '';
        if(request.locale === 'de-DE') {
            speechOutput = "Die Top 3 für dein Wochenende in Berlin: ";
            for (var i = 0; i < events.length; i++) {
                speechOutput += 'Am ' + moment.weekdays(events[i].weekday()) + ' \'' + events[i].title + '. Location: ' + events[i].location + '.';
            }
        } else {
            speechOutput = "The top 3 picks for your weekend in Berlin are: ";
            for (var i = 0; i < events.length; i++) {
                speechOutput += 'On ' + moment.weekdays(events[i].weekday()) + ' \'' + events[i].title + ' at ' + events[i].location + '.';
            }
        }
        response.tell(speechOutput);
    }, function(errorFeedback){
        if(request.locale === 'de-DE') {
            response.tell('Ich konnte keine Ergebnisse finden.')
        } else {
            response.tell('I couldn\'t find any results.');
        }
    });
}

// --------------- Helper Functions  -----------------------

var helper = {

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

module.exports = app;