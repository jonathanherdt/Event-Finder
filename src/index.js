var fs = require('fs');
var request = require("request");
var cheerio = require("cheerio");
var moment = require("moment");
var Alexa = require('alexa-app');

var app = new Alexa.app('eventfinder');

var helpAndLaunchFunction = function (request, response) {
    var prompt, reprompt;
    if(request.data.request.locale === 'de-DE') {
        reprompt = 'Mit Events für welche Stadt kann ich dir helfen?';
        prompt = "Du kannst mich Sachen wie folgt fragen: 'Frag Event-Finder nach Events in Berlin an diesem Wochenende!', oder, du kannst 'Ende!' sagen... Ich kann dir aktuell Events für Berlin, Leipzig, München und Köln über Ask Helmut liefern. Wie kann ich dir helfen?";
    } else {
        reprompt = 'Which city do you want to get events for?';
        prompt = "You can make a request like 'Ask event finder what's going on this weekend in Berlin?', or, you can say 'Exit!'... Currently I can give you events for Berlin, Leipzig, Munich and Cologne, via Ask Helmut. What can I help you with?";
    }
    response.say(prompt).reprompt(reprompt).shouldEndSession(false).send();
}

app.launch(helpAndLaunchFunction);

app.intent('AMAZON.HelpIntent', helpAndLaunchFunction);

var exitFunction = function (request, response) {
    var speechOutput;
    if(request.data.request.locale === 'de-DE') {
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
        'utterances': ['Frag Ausgeh-Planer nach Events in {-|City} {|an|am|im} {-|Date}',
            'Frag Ausgeh-Planer nach Events {|an|am|im} {-|Date} in {-|City}',
            'Frag Ausgeh-Planer was {|an|am|im} {-|Date} los ist in {-|City}']
        // English
        // 'utterances': ['{|tell me|what is} {|Pitchfork\'s|the} album rating of {-|Album} {by|from} {-|Artist}',
        // '{-|Album} by {-|Artist}']
    },
    function (request, response) {
        handleEventRequest(request, response);
        // Gotta return false because we handle the response asynchronously
        return false;
    }
)

function handleEventRequest(request, response) {
    var date = request.slot('Date'), city = request.slot('City');

    if(!date) {
        response.say('Ich konnte das Datum nicht richtig verstehen').send();
        return;
    }
    if(!city) {
        response.say('Ich konnte die Stadt nicht richtig verstehen').send();
    }

    helper.getAskHelmutEvents(city, date, function(events, typeOfDate) {
        var speechOutput = '';
        var cardTitle = '';
        var cardContent = '';
        var cardImage = '';
        if(request.data.request.locale === 'de-DE') {
            cardTitle = 'Top-Events in ' + city;
            if(events.length === 0) {
                speechOutput = 'Tut mir leid, ich konnte keine Events in ' + city + ' finden.';
                cardContent = speechOutput;
            } else {
                // Make sure the week days are pronounced in the correct language
                moment.locale('de');
                cardImage = events[0].image;
                speechOutput = "Deine Top-Events in " + city + ": ";
                for (var i = 0; i < events.length && i < 3; i++) {
                    if(typeOfDate === 'wholerange') {
                        // See https://momentjs.com/docs/#/displaying/format/ for information
                        // on formatting
                        speechOutput += 'Am ' + events[i].date.format('Do MMMM');
                    } else if(typeOfDate !== 'day') {
                        speechOutput += 'Am ' + moment.weekdays(events[i].date.weekday());
                    }
                    speechOutput += ' ' + events[i].title + ' . Location: ' + events[i].location + ' . ';
                    cardContent += (i + 1) + '.: ' + events[i].title + '\nLocation: ' + events[i].location + '\n';
                }
            }
        } else {
            cardTitle = 'Top Events in ' + city;
            if(events.length === 0) {
                speechOutput = 'I\'m sorry, I couldn\'t find any events in ' + city;
            } else {
                // Make sure the week days are pronounced in the correct language
                moment.locale('en');
                cardImage = events[0].image;
                speechOutput = "Your top picks in " + city + ": ";
                for (var i = 0; i < events.length && i < 3; i++) {
                    if(typeOfDate === 'wholerange'){
                        // See https://momentjs.com/docs/#/displaying/format/ for information
                        // on formatting
                        speechOutput += 'On ' + events[i].date.format('Do MMMM');
                    } else if(typeOfDate !== 'day'){
                        speechOutput += 'On ' + moment.weekdays(events[i].date.weekday());
                    }
                    speechOutput += ' ' + events[i].title + ' at ' + events[i].location + ' . ';
                    cardContent += (i + 1) + '.: ' + events[i].title + '\nLocation: ' + events[i].location + '\n';
                }
            }
        }
        // Add a card displaying more information about the events
        response.card({
            type: "Standard",
            title: cardTitle, // this is not required for type Simple or Standard
            text: cardContent,
            image: {
                largeImageUrl: cardImage
            }
        });
        response.say(speechOutput).send();
    }, function(errorFeedback){
        if(request.data.request.locale === 'de-DE') {
            response.say('Ich konnte keine Ergebnisse finden.').send()
        } else {
            response.say('I couldn\'t find any results.').send();
        }
    });
}

// --------------- Helper Functions  -----------------------

var helper = {

    /** Gets events for the given city at the given time range.
     *  Calls the callbackfunction with the an array of events, sorted by popularity.
     */
    getAskHelmutEvents: function (city, date, callbackFunction, errorCallbackFunction) {
        var typeOfDate;
        // Take care of dates where the week is displayed with only one digit, make it two digits
        if(date.lastIndexOf('-') === 7 && date.indexOf('W') > 0) {
            date = date.slice(0,6) + '0' + date.slice(6);
        }
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
        // Get the cities in a format that Ask Helmut understands
        if (city === 'Köln') {
            city = 'Cologne';
        } else if (city === 'München') {
            city = 'Munich';
        }
        // Scrape https://askhelmut.com/lists/helmuts-list-berlin to find events for the given time
        // Scrape tutorial here: https://www.sitepoint.com/web-scraping-in-node-js/
        request({
            uri: 'https://askhelmut.com/lists/helmuts-list-' + city.toLowerCase(),
        }, function(error, response, body) {
            try{
                var $ = cheerio.load(body);
                var days = $(".event-tile");
                var events = [];
                days.each(function(index, element) {
                    var loadedElement = cheerio.load(element);
                    var eventObject = JSON.parse(loadedElement(".event-tile__favorites")['0'].attribs['data-react-props']);
                    eventObject.image = loadedElement(".event-tile__cover-image > img")['0'].attribs['src'];
                    var eventDate = eventObject.tracking.resource.substr(8, 10);
                    if(eventDate.indexOf('-') === 4) {
                        eventDate = moment(eventObject.tracking.resource.substr(8, 10), 'YYYY-MM-DD');
                    } else {
                        eventDate = moment(eventObject.tracking.resource.substr(8, 10), 'DD-MM-YYYY');
                    }
                    // See if the given event takes place in the given timerange
                    if (typeOfDate === 'wholerange' || 
                        (typeOfDate === 'week' && eventDate.isBetween(date, date.clone().add(7, 'days'), null, '[)')) ||
                        (typeOfDate === 'weekend' && eventDate.isBetween(date, date.clone().add(2, 'days'), null, '[]')) || 
                        (typeOfDate === 'day' && date.isSame(eventDate))
                        ) {
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

                callbackFunction(sortedEvents, typeOfDate);
                
            } catch (error) {
                errorCallbackFunction(error);
            }
        });
    }
};

module.exports = app;