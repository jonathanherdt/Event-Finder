var fs = require('fs');
var Alexa = require('alexa-app');

var EventFinderHelper = require('./event-finder-helper');
var helper = new EventFinderHelper();

var app = new Alexa.app('eventfinder');

var helpAndLaunchFunction = function (request, response) {
    var prompt, reprompt;
    if(request.data.request.locale === 'de-DE') {
        reprompt = 'Mit Events für welche Stadt kann ich dir helfen?';
        prompt = "Du kannst mich Sachen wie folgt fragen: frag Ausgeh-Planer nach Events an diesem Wochenende in Berlin, oder, du kannst Ende! sagen... Ich kann dir aktuell Events für Berlin, Leipzig, München und Köln über Ask Helmut liefern. Wie kann ich dir helfen?";
    } else {
        reprompt = 'Which city do you want to get events for?';
        prompt = "You can make a request like Ask event finder what's going on this weekend in Berlin?, or, you can say Exit! ... Currently I can give you events for Berlin, Leipzig, Munich and Cologne, via Ask Helmut. What can I help you with?";
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
            'Frag Ausgeh-Planer nach Events {|an|am|im|in} {-|Date} in {-|City}',
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

    if(!date && !city){
        helpAndLaunchFunction(request, response);
    }
    else {
        if(!date) {
            response.say('Ich konnte das Datum nicht richtig verstehen').send();
            return;
        }
        if(!city) {
            response.say('Ich konnte die Stadt nicht richtig verstehen').send();
            return;
        }
        if(['berlin', 'leipzig', 'cologne', 'köln', 'munich', 'münchen'].indexOf(city.toLowerCase()) === -1){
            response.say('Ich habe' + city + ' leider nicht in meiner Datenbank. Ich kann dir aktuell Events für Berlin, Leipzig, München und Köln über Ask Helmut liefern.').send();
            return;
        }
    }

    helper.getAskHelmutEvents(city, date, function(events, typeOfDate) {
        var speechOutput = helper.prepareSpeechOutput(request.data.request.locale, city, events, typeOfDate);
        if(events.length > 0){
            var card = helper.prepareResponseCard(request.data.request.locale, city, events);
            if(card){
                response.card(card);
            }
        }
        response.say(speechOutput).send();
    }, function(errorFeedback){
        if(request.data.request.locale === 'de-DE') {
            response.say('Ich konnte keine Ergebnisse finden.').send()
        } else {
            response.say('I couldn\'t find any results.').send();
        }
    });
}

module.exports = app;