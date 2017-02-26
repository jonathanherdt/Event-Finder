'use strict';

function EventFinderHelper() { }

/**
 * Returns a card object pre-filled with everything that Alexa expects from a card response.
 * In case there are no events, undefined is returned.
 */
EventFinderHelper.prototype.prepareResponseCard = function(request, city, events) {
    var cardImage = '';
    var cardObject = {
        type: "Standard",
        title: '',
        text: '',
    }

    if(events.length === 0) {
        return undefined;
    } else {
        for (var i = 0; i < events.length && i < 3; i++) {
            cardObject.text += (i + 1) + '.: ' + events[i].title + '\nLocation: ' + events[i].location + '\n';
        }
        city = city.charAt(0).toUpperCase() + city.substring(1);
        if(request.data.request.locale === 'de-DE') {
            cardObject.title = 'Top-Events in ' + city;
        } else {
            cardObject.title = 'Top Events in ' + city;
        }
        if(events[0].image){
            cardObject.image = {
                largeImageUrl: events[0].image
            }
        }
        return cardObject;
    }
};

EventFinderHelper.prototype.prepareSpeechOutput = function(request, city, events, typeOfDate) {
    var speechOutput = '';
    if(request.data.request.locale === 'de-DE') {
        if(events.length === 0) {
            speechOutput = 'Tut mir leid, in meiner Datenbank sind keine Events für die von dir angegebene Zeit in ' + city + '.';
        } else {
            // Make sure the week days are pronounced in the correct language
            moment.locale('de');
            speechOutput = "Deine Top-Events in " + city + ": ";
            for (var i = 0; i < events.length && i < 3; i++) {
                speechOutput += "Nummer " + (i + 1) + ": ";
                if(typeOfDate === 'wholerange') {
                    // See https://momentjs.com/docs/#/displaying/format/ for information
                    // on formatting
                    speechOutput += 'Am ' + events[i].date.format('Do MMMM');
                } else if(typeOfDate !== 'day') {
                    speechOutput += 'Am ' + moment.weekdays(events[i].date.weekday());
                }
                speechOutput += ' ' + events[i].title + ' . Location: ' + events[i].location + ' . ';
            }
        }
    } else {
        if(events.length === 0) {
            speechOutput = 'I\'m sorry, my database does not have any events for the time you gave me in ' + city;
        } else {
            // Make sure the week days are pronounced in the correct language
            moment.locale('en');
            speechOutput = "Your top picks in " + city + ": ";
            for (var i = 0; i < events.length && i < 3; i++) {
                speechOutput += "Number " + (i + 1) + ": ";
                if(typeOfDate === 'wholerange'){
                    // See https://momentjs.com/docs/#/displaying/format/ for information
                    // on formatting
                    speechOutput += 'On ' + events[i].date.format('Do MMMM');
                } else if(typeOfDate !== 'day'){
                    speechOutput += 'On ' + moment.weekdays(events[i].date.weekday());
                }
                speechOutput += ' ' + events[i].title + ' at ' + events[i].location + ' . ';
            }
        }
    }

    return speechOutput;
};

/** Gets events for the given city at the given time range.
 *  Calls the callbackfunction with the an array of events, sorted by popularity.
 */
EventFinderHelper.prototype.getAskHelmutEvents =  function (city, date, callbackFunction, errorCallbackFunction) {
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
};

module.exports = EventFinderHelper;