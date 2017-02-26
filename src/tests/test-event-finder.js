// Test this file in the command line with the command `mocha <this file>`

'use strict';

var chai = require('chai');
var moment = require("moment");
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;
chai.config.includeStack = true;

var EventFinderHelper = require('../event-finder-helper');

describe('EventFinderHelper', function() {

    var helper = new EventFinderHelper();

    describe('#getDate', function() {
        var dateFormat = 'YYYY-MM-DD';

        context('with a weekend date', function() {
            it('returns a usable date', function() {
                var value = helper.prepareDateForMoment('2017-W8-WE');
                return expect(value.date.format(dateFormat)).to.eq('2017-02-24');
            });
        });

        context('with a week date', function() {
            it('returns a usable date', function() {
                var value = helper.prepareDateForMoment('2017-W8');
                return expect(value.date.format(dateFormat)).to.eq('2017-02-20');
            });
        });

        context('with a month date', function() {
            it('returns a usable date', function() {
                var value = helper.prepareDateForMoment('2017-02');
                return expect(value.date.format(dateFormat)).to.eq('2017-02-01');
            });
        });

        context('with a day date', function() {
            it('returns a usable date', function() {
                var value = helper.prepareDateForMoment('2017-02-26');
                return expect(value.date.format(dateFormat)).to.eq('2017-02-26');
            });
        });

        context('with a gibberish date', function() {
            it('doesn\'t fail', function() {
                var value = helper.prepareDateForMoment('gibberish');
                console.log(value.date);
                return expect(value.date).to.be.undefined;
            });
        });
    });

    describe('#getCard', function() {
        var city = 'Berlin';
        var locale = 'de-DE';

        var title = 'ABC';
        var location = 'here';
        var image = 'www.example.com/example.JPG';
        var exampleEvents = [
            {
                title: title + '1',
                location: location + '1',
                image: image
            },
            {
                title: title + '2',
                location: location + '2',
                image: image
            },
            {
                title: title + '3',
                location: location + '3',
                image: image
            }
        ];

        context('empty events', function() {
            it('doesn\'t fail', function() {
                var value = helper.prepareResponseCard(locale, city, []);
                return expect(undefined).to.be.undefined;
            });
        });

        context('three dummy events', function() {
            it('returns a correct response card', function() {
                var value = helper.prepareResponseCard(locale, city, exampleEvents);
                return expect(value).to.have.deep.property('image.largeImageUrl', image);
            });
        });

        context('one dummy event without image', function() {
            it('returns a correct response card', function() {
                var eventsWithoutImages = exampleEvents.slice(0,1);
                eventsWithoutImages[0].image = undefined;
                var value = helper.prepareResponseCard(locale, city, eventsWithoutImages);
                return expect(value).to.eql({
                    type: "Standard",
                    title: 'Top-Events in Berlin',
                    text: '1.: ' + eventsWithoutImages[0].title + '\nLocation: ' + eventsWithoutImages[0].location + '\n'
                });
            });
        });
    });

    describe('#getEventsFromAskHelmut', function() {
        context('get events for tomorrow', function() {
            it('works without errors', function() {
                var tomorrow = new Date(new Date().getTime() + 1000*60*60*24*1);
                var month = (tomorrow.getMonth() + 1);
                if(month <= 9){
                    month = '0' + month;
                }
                var dateString = tomorrow.getFullYear() + '-' + month + '-' + tomorrow.getDate();
                var promiseFunction = function(){
                    firstEvent = events[0];
                };
                var firstEvent = new Promise(function (resolve, reject){
                    helper.getAskHelmutEvents( 'Berlin', dateString, function(events, typeOfDate){
                        resolve(events[0]);
                    }, function(){});
                });

                return expect(firstEvent).to.eventually.have.property('title');
            });
        });
    });

});

