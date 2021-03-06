// Feature Requests/TODO
// 1 - Reset button if you decide to select away from English and to Dutch and then want to go back to English
// 2 - Force continuous replication for couchdb on startup for Android client ->  @janl, help me out yo!
// 3 - check to see that the translation doesn't === the original phrase.
// 4 - Add ability to make translated text full screen so you can show someone who speaks that language so it is easy to read on your mobile device.

var languages,
	doc = '',
	isGapped = false,
   	couchDbExists = false,
	networkState = null;

$().ready(function ()
{

	// Capitalize the first letter of a string.
    $.capFirst = function (string)
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // http://stackoverflow.com/questions/499126/jquery-set-cursor-position-in-text-area
    // yeah, wtf is this?  it's the same thing just so you know...
    $['prototype' || 'fn'].selectRange = function(start, end) {
        return this.each(function() {
                if(this.setSelectionRange) {
                        this.focus();
                        this.setSelectionRange(start, end);
                } else if(this.createTextRange) {
                        var range = this.createTextRange();
                        range.collapse(true);
                        range.moveEnd('character', end);
                        range.moveStart('character', start);
                        range.select();
                }
        });
	};
    
    // derp
    var currentLang = 'English',
     	isTitanium = (typeof window.Titanium === 'object') ? true : false;

    // just for less typing; premature optimization...whatever...    
    var $messageFrom = $('#messageFrom'),
        $h1 = $('h1:first'),
        $run = $('#run'),
        $clear = $('#clear'),
        $output = $('#output'),
        $langInput = $('#langInput'),
        $langOutput = $('#langOutput');


    // Getter:  $.data(document.body, "config").langFrom
    // We may use some or add some propeties later to be used for someful, well, useful.
    $.data(document.body, "config", {
        langFrom: currentLang
    });

    $.data(document.body, "view", "home");

	// Toggle copy and form in < 533px wide view.
    $('#link-about').bind('click', function ()
    {

        var view = $.data(document.body, "view");
        var out = view === 'home' ? 'home' : 'about';
        var into = view === 'home' ? 'about' : 'home';

        $('#' + out).fadeOut(300, function ()
        {
            var $that = $(this);
            $('#' + into).fadeIn(300, function ()
            {

                $.data(document.body, "view", into);
                $('#link-about').text($.capFirst(out));
                // FFFFUUUUU inlne style FTL
                $that.attr('style', '').addClass('counter-hide');
                $(this).removeClass('counter-hide');

		        $messageFrom.focus();

            });
        });


        return false;
    });


	// If they hit enter, send it.  usability issue maybe?  think about a textarea...
    $messageFrom.bind('keypress', function (e)
    {
        if (e.charCode == 13)
        {
            $(document).trigger('##TRANSLATE_TEXT##');
            e.preventDefault();
        }
    });

    // Treat the H1 like a proper anchor tag...
    $h1.bind('click', function (e)
    {
        window.location.reload(); // yes we could just make this an anchor tag, but it's a prototype AND an anchor tag's path won't work in android/titanium.
        e.stopPropagation();
    });


    // We could do the following:, but causes usability issues so a no go.  Leave in here! It's a prototype.
    // $langInput.bind('change', translateUi); 
       
    $run.click(function (e)
    {
        $(document).trigger('##TRANSLATE_TEXT##');
        e.preventDefault();
    });

    $clear.bind('click', function (e)
    {
        $('textarea').text('');
        e.preventDefault();
    });


	// The translate method taken directly from translate.js example and reworked a bit.
    $(document).bind('##TRANSLATE_TEXT##', function (e)
    {

        // TODO: Sanitize this shit.
        // Set input values
        var input = $langInput.val(),
            output = $langOutput.val(),
            message = $messageFrom.val();

        // update the button's state
        $run.attr('disabled', 'disabled');
        $run.val('translating...');

        if (isGapped && (typeof networkState === 'undefined') && couchDbExists )
        {
            // testing offline android client...if ur offline in ur browser, not supported for prototype...
            offlineLookup(input, output, message, function ()
            {
                $run.attr('disabled', '');
                $run.val('Translate');
            });

            return;
        }

        // otherwise, use the Google Translation API
        translate.text(
        {
            input: input,
            output: output
        }, message, function (result)
        {
            $run.attr('disabled', '');
            $run.val('Translate');

            var obj =
            {
                'message': message,
                'output': result,
                'from': input,
                'to': output
            }

            storeInCouch(obj);

            $output.val(result);
            $output.selectRange(0, $output.val().length);  // let's make it copy friendly.
            
            if(isGapped)
            {
            	// Notify natively in Phonegap app.
				navigator.notification.beep(2);
	            navigator.notification.vibrate(250);
            }
            
            // Notify system notification on desktop app
            if(isTitanium) Titanium.Media.beep();


        });
    });
    
    
	// Grab all languages and populate the options of the select elements.
	function populateLangs()
	{
	
		// capture the languages...
		languages = getLangs();
	
	    // populate...
	    for (var lang in languages)
	    {
	        $langInput.append('<option value = "' + lang + '">' + lang + '</option>');
	        $langOutput.append('<option value = "' + lang + '">' + lang + '</option>');
	    }

	}
	

	// Call store via XHR passing some ish for couchdb at couchone.
    function storeInCouch(obj)
    {
    	// Express let's me handle this very easily...just set it up to handle the request and be done.
        $.get( ( isGapped || isTitanium ) ? 'http://felonyring.com:3001/store' : '/store', obj, function (data)
        {
            console.log(data + " is the new revision of the db.")
        });
    }

	// do some shit when you are checking for offline access.
    function offlineLookup(from, to, message, cb)
    {

        // Yes this additional function is unnecessary, but I left it open incase there were other 
        // sync-based functions to call here while developing the app.
        getOfflineCouch(from, to, message, function ()
        {
            // beep!
            navigator.notification.beep(2);
            navigator.notification.vibrate(250);
            cb && cb();
        });

    }

	// Check the couchdb on Android if we are offline.
    function getOfflineCouch(from, to, message, cb)
    {

        // TODO: Sanitize this...maybe.  I'm looking at you @slexaxton...
        var compoundKey = from.toLowerCase() + "_" + to.toLowerCase();
        var words = [];
        words = message.split(" ");
        var firstword = words[0].toLowerCase();

        console.log(firstword + " is the first word.")
        console.log(compoundKey + " is the compound key.")

        // Does compoundKey exist?
        if (typeof doc[compoundKey] === 'undefined')
        {
            offlineResult(false, 'The compound key was not found.');
            return;
        }
        else
        {
            // Does the firstword key exist?
            if (typeof doc[compoundKey][firstword] === 'undefined')
            {
                offlineResult(false, 'The first word was not found.');
            }
            else
            {
                // iterate over the array looking for the phrase and if it exists, pass the translation to the result.
                var messageExists = false;
                var index = -1;

                doc[compoundKey][firstword].forEach(function (el, i, a)
                {
                    if (el.from === message)
                    {
                        messageExists = true;
                        matchedTranslatedPhrase = el.to;
                        index = i;
                    }
                });

                if (messageExists)
                {
                    offlineResult(true, 'The message was found.', matchedTranslatedPhrase);
                    cb && cb(); // could combine these two lines to one line but easier to read.
                }
                else
                {
                    // add the new message, output and timestamp
                    offlineResult(false, 'The message was not found.');
                }
            }
        }


    }

    // It's kinda like error handling, in a cadillac...
    function offlineResult(flag, logMessage, translation)
    {
        if (flag)
        {
            $('#output').val(translation);
            console.log(logMessage);
        }
        else
        {
            console.log(logMessage);
        }
    }

	// some shit for our desktop app.
    function titaniumSpecific()
    {
    	document.body.className = 'titanium';
    	$('#about p:not(:first)').remove();
    }


    // translates the entire Ui in the language from drop down so the UI converts to that persons native languae.
    function translateUi()
    {
        // Let's automagically update the UI to show those phrases in the appropriate language.
        // Grab all text elements on the page
        var input = $.data(document.body, "config").langFrom;
        var output = $('#langInput option:selected').val();

        // Could definitely be optimized to not send so many requests, but f it for now.
        $('label, input[type=button], option, textarea, p, a').each(function (i, el)
        {
            translate.text(
            {
                input: input,
                output: output
            }, el[!el.innerHTML ? 'value' : 'innerHTML'], function (result)
            {
                try
                {
                    el[!el.innerHTML ? 'value' : 'innerHTML'] = result;
                }
                catch (e)
                {
                    //				console.log(e);
                }
            });
        });

        $.data(document.body, "config", {
            langFrom: output
        });

    }

	function init()
	{
		populateLangs();
		
	    $run.attr('disabled', '');

	    // TODO: Check local storage for prefs and if not there, populate with the following:
	    $langInput.val('English');
    	$langOutput.val('Dutch');
    	
    	if(isTitanium) titaniumSpecific();
    	
	}


    // Chromeless dragging in Titanium Desktop app
    (function ()
    {
        var dragging = false;

        document.onmousemove = function ()
        {
            if (!dragging || !isTitanium) return;

            Titanium.UI.currentWindow.setX(Titanium.UI.currentWindow.getX() + event.clientX - xstart);
            Titanium.UI.currentWindow.setY(Titanium.UI.currentWindow.getY() + event.clientY - ystart);

        }

        document.onmousedown = function (e)
        {
            // disallow textarea
            if (isTitanium && e.target.className !== 'box')
            {
                dragging = true;
                xstart = event.clientX;
                ystart = event.clientY;
            }
        }

        document.onmouseup = function ()
        {
            dragging = false;
        }
    })();



	// Go.
	init();

});

window.onload = function ()
{
	// Lose the URL bar for mobile version...
	/mobile/i.test(navigator.userAgent) && !location.hash && setTimeout(function ()
	{
		window.scrollTo(0, 1);
	}, 1000);

    document.addEventListener('deviceready', function ()
    {
        if ( !! (device.platform) )
        {
            // So we are on the Android device.
            isGapped = true;
       
            // Let's load up the db from couch for quick access.
            // Also, REALLY weak way to check for Couch's existence.
            $.ajax(
            {
                url: 'http://127.0.0.1:5984/lingua/lingua-couch',
                success: function (data)
                {
                    doc = JSON.parse(data);
                    data && console.log('Successfully snagged data from couchdb.');
                    couchDbExists = true;
                },
                error: function(xhr, status)
                {
      				console.log("CouchDB response status: "+ status);
                	console.log("Pretty sure CouchDB on Android isn't installed, but our test is super weak.");
                }
            });
            
            
            // http://docs.phonegap.com/phonegap_network_network.md.html#network.isReachable
            function reachableCallback(reachability) 
            {
		    	// There is no consistency on the format of reachability
		    	
    			var state = reachability.internetConnectionStatus || reachability.code || reachability;

    			var states = {};
    			states[NetworkStatus.NOT_REACHABLE]                      = 'No network connection';
    			states[NetworkStatus.REACHABLE_VIA_CARRIER_DATA_NETWORK] = 'Carrier data connection';
    			states[NetworkStatus.REACHABLE_VIA_WIFI_NETWORK]         = 'WiFi connection';

    			console.log('Connection type: ' + states[state]);
    			
    			networkState = states[state];
			}
			
			navigator.network.isReachable('google.com', reachableCallback);
            
        }
    }, false);
    
    
}