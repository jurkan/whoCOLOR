// ==UserScript==
// @name         whoCOLOR Userscript
// @namespace    http://wikicolor.net/
// @version      1.0
// @description  Displays authorship information on wikipedia
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js
// @require		   http://wikicolor.net/moment-with-locales.js?v=1
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getResourceText
// @grant        GM_log
// @match        http://en.wikipedia.org/*
// @match        https://en.wikipedia.org/*
// @copyright    2015+, Felix Stadthaus
// ==/UserScript==

// The MIT License (MIT)
//
// Copyright (c) 2015 Felix Stadthaus
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// See her for some resource licenses:
//
// https://commons.wikimedia.org/w/index.php?title=File:Clear_icon.svg&oldid=149014810
// https://commons.wikimedia.org/w/index.php?title=File:Article_icon.svg&oldid=148759157
// https://commons.wikimedia.org/w/index.php?title=File:ArticleSearch.svg&oldid=150569436
// https://commons.wikimedia.org/w/index.php?title=File:Speechbubbles_icon.svg&oldid=148758659
// By MGalloway (WMF) (Own work) [CC BY-SA 3.0 (http://creativecommons.org/licenses/by-sa/3.0)], via Wikimedia Commons
//
// https://commons.wikimedia.org/w/index.php?title=File:UserAvatar.svg&oldid=150569452
// By MGalloway (WMF) (Own work) [CC BY-SA 4.0 (http://creativecommons.org/licenses/by-sa/4.0)], via Wikimedia Commons
//
// https://commons.wikimedia.org/w/index.php?title=File:Speechbubbles_icon_green.svg&oldid=135292327
// By Chiefwei (Own work) [CC BY-SA 4.0 (http://creativecommons.org/licenses/by-sa/4.0)], via Wikimedia Commons
//
// http://www.ajaxload.info/ <-- The origin of ajax-loader.gif (License: WTFPL, http://www.wtfpl.net/)

Wikiwho = {
    /* A few configuration options */
    // Where to fetch Wikicolor data from
    wikicolorUrl: "https://api.wikicolor.net/whocolor/",

    // Color palette for highlighting of tokens (Kelly)
    tokenColors: [
    	"#FFB300", "#803E75", "#FF6800", "#A6BDD7", "#C10020", "#CEA262", "#817066",
    	
    	// The following is not good for people with defective color vision
    	"#007D34", "#F6768E", "#00538A", "#FF7A5C", "#53377A", "#FF8E00", "#B32851", "#F4C800", "#7F180D", "#93AA00", "#593315", "#F13A13", "#232C16"
    ],
    
    /* Other initial values */
    // Specifies whether the original, unaltered content is shown
    showingUnalteredContent: true,
    // True, when initialized has already been called to prevent double initialization
    initialized: false,
    // Array with colored authors (and the colors they are colored with)
    coloredAuthors: {},
    // Variable holding the timeout that deselects the currently selected author
    deselectTimeout: null,
    // Variable telling whether history view is opened
    historyViewOpen: false,
    // Variable telling whether conflict view is opened
    conflictViewOpen: false,
    
    /* Methods */
    
    // Determines whether white or black are the more contrasting colors (via the YIQ color model)
    getContrastingColor: function(color){
        var red = parseInt(color.substr(1, 2), 16);
        var green = parseInt(color.substr(3, 2), 16);
        var blue = parseInt(color.substr(5, 2), 16);
        var yiq = (299*red + 587*green + 114*blue) / 1000;
        return (yiq >= 128) ? ['black', 'darkblue'] : ['white', 'lightblue'];
    },
    
    // Determines whether white or black are the more contrasting colors (via the YIQ color model)
    getContrastingColorRGB: function(red, green, blue){
        var yiq = (299*red + 587*green + 114*blue) / 1000;
        return (yiq >= 128) ? ['black', 'darkblue'] : ['white', 'lightblue'];
    },
    
    // Creates basic HTML elements like menu bars or buttons etc.
    createHTMLElements: function() {
        // Holds the altered Wikimedia content HTML markup
        Wikiwho.newcontent = $("<div></div>");
        Wikiwho.newcontent.css('background', 'url('+Wikiwho.wikicolorUrl+'static/ajax-loader.gif) no-repeat center center').css('min-height', '32px');
        
        // Holds the original, unaltered Wikimedia content HTML markup
        Wikiwho.originalcontent = $("#mw-content-text");
        
        // Add the altered content to the page (but hide it)
        $(Wikiwho.originalcontent[0].attributes).each(function() { Wikiwho.newcontent.attr(this.nodeName, this.value); });
        Wikiwho.originalcontent.after(Wikiwho.newcontent);
        Wikiwho.newcontent.hide();
        
        // The button to switch into wikicolor mode
    	Wikiwho.onoffbutton = $('<li id="wikiwhoonoffbutton"><span><a>whoCOLOR</a></span></li>');	
        $("div#p-views ul").prepend(Wikiwho.onoffbutton);
        Wikiwho.onoffbutton.find("a").click(function() { Wikiwho.onoffbuttonclick(); });
        
        // The menu on the right (displaying authors)
        var elementTop = $('#content').offset().top + 1;
        
        Wikiwho.rightbar = $('<div id="wikiwhorightbar" class="mw-body"></div>').hide().prependTo($("div#content.mw-body"));
        $("div#content.mw-body").css("position", "relative");
        Wikiwho.rightbar.css("top", "5em");
        Wikiwho.rightbar.css("right", "calc(-15.5em - 3px)");
        
        Wikiwho.rightbarcontent = $('<div></div>').appendTo(Wikiwho.rightbar);

        $(window).scroll(function(){
            if($(window).scrollTop() > elementTop){
                $('#wikiwhorightbar').css('top', '0px');
            } else {
                $('#wikiwhorightbar').css('top', (elementTop-$(window).scrollTop())+'px');
            } 
        });
        
        $(window).scroll();
        
        // Author list
        $('<div id="conflictviewbutton" title="Conflict view"/>').appendTo(Wikiwho.rightbarcontent);
        $('<h2>Author List</h2>').appendTo(Wikiwho.rightbarcontent);
        $('<ul id="wikiwhoAuthorList"></ul>').appendTo(Wikiwho.rightbarcontent);
        
        // Conflict view open button click event
        $('#conflictviewbutton').click(function() {
            if(Wikiwho.conflictViewOpen) {
                Wikiwho.closeConflictView();
            } else {
                Wikiwho.openConflictView();
            }
        });
        
        // The sequence history
        Wikiwho.seqHistBox = $('<div id="wikiwhoseqhistbox"></div>').hide().appendTo($("div#content.mw-body"));
        Wikiwho.seqHistBox.append('<div id="wikiwhoseqhistboxopenindicator"><a>&#9650; Click here to open the whoCOLOR word history for the selected text &#9650;</a></div>');
        Wikiwho.seqHistBox.append('<div id="wikiwhoseqhistboxtoolongindicator">Selected text part is too long for the whoCOLOR word history</div>');
        Wikiwho.seqHistBox.append('<div id="wikiwhoseqhistboxonerevindicator">All the selected wiki markup was added in the currently viewed revision.</div>');
        Wikiwho.seqHistBox.append('<img src="http://wikicolor.net/Clear_icon.svg" class="hvcloseicon"/>');
        Wikiwho.histview = $('<div id="wikiwhoseqhistview"></div>').appendTo(Wikiwho.seqHistBox);
    },
    
    onoffbuttonclick: function() {
        Wikiwho.onoffbutton.toggleClass("selected");
        if(Wikiwho.showingUnalteredContent) {
            Wikiwho.showAlteredContent();
        }else{
            Wikiwho.showUnalteredContent();
        }
    },
    
    showAlteredContent: function() {
        // Don't do anything if already showing the altered content
        if(!Wikiwho.showingUnalteredContent) return true;
        
        // The actual content replacement (just visual for the sake of speed)
        Wikiwho.originalcontent.attr("id", "old-mw-content-text")
        Wikiwho.newcontent.attr("id", "mw-content-text")
        Wikiwho.originalcontent.fadeOut(250, function() { Wikiwho.originalcontent.hide(); Wikiwho.newcontent.fadeIn(250, function() { Wikiwho.newcontent.show(); }); });
        //Wikiwho.newcontent.show();
        //Wikiwho.originalcontent.attr("id", "old-mw-content-text").hide();
        //Wikiwho.newcontent.attr("id", "mw-content-text");
        
        // Squeeze main content a bit and show the bar to the right
        //$("div#content").css("margin-right", "251px");
        Wikiwho.rightbar.animate({"right": "0px"}, 500, function() {});
        $("div#content").animate({"margin-right": "15.5em"}, 500, function() {});
        Wikiwho.rightbar.show();
        
        // Change flag
        Wikiwho.showingUnalteredContent = false;
    },
    
    showUnalteredContent: function() {
        // Don't do anything if already showing the unaltered content
        if(Wikiwho.showingUnalteredContent) return true;
        
        // The actual content replacement (just visual for the sake of speed)
        //Wikiwho.originalcontent.show();
        Wikiwho.newcontent.attr("id", "new-mw-content-text");
        Wikiwho.originalcontent.attr("id", "mw-content-text");
        Wikiwho.newcontent.fadeOut(250, function() { Wikiwho.newcontent.hide(); Wikiwho.originalcontent.fadeIn(250, function() { Wikiwho.originalcontent.show(); }); });
        
        // Unsqueeze main content and hide the bar to the right
        //$("div#content").css("margin-right", "");
        //$("div#content").animate({"margin-right": ""}, 500, function() { Wikiwho.rightbar.hide(); });
        Wikiwho.rightbar.animate({"right": "-15.6em"}, 500, function() { Wikiwho.rightbar.hide(); });
        $("div#content").animate({"margin-right": ""}, 500, function() {});
        //Wikiwho.rightbar.hide();
        
        // Change flag
        Wikiwho.showingUnalteredContent = true;
    },
    
    // Restore the original Mediawiki content
    restoreMWContent: function() {
        Wikiwho.originalcontent.show();
        Wikiwho.newcontent.hide();
    },
    
    // get Wikiwho author data via ajax
    getWikiwhoData: function() {
        if(!Wikiwho.tries) Wikiwho.tries = 0;
        Wikiwho.tries++;
        
        if(Wikiwho.tries > 3) {
            // Failed 3 times, stop trying
            alert("Failed to retrieve valid Wikiwho data.");
            return;
        }
        
        var queryDict = {}
        location.search.substr(1).split("&").forEach(function(item) {queryDict[item.split("=")[0]] = item.split("=")[1]});
        var data = {
            "title": $("h1#firstHeading").text()
        };
        if(queryDict["oldid"]) data["revid"] = queryDict["oldid"];
        jQuery.ajax({
            url: Wikiwho.wikicolorUrl+"index.php",
            data: data,
            dataType: "json",
            success: Wikiwho.wikiwhoDataCallback,
            error: function() {
                // Request failed, try again
                setTimeout(Wikiwho.getWikiwhoData, 5000);
                return;
            }
        });
    },
    
    wikiwhoDataCallback: function(data) {
        // Retry when no success
        if(!data.success == true) {
            setTimeout(Wikiwho.getWikiwhoData, 5000);
            return;
        }
        
        // Add extended markup content
        Wikiwho.newcontent.append(data.html);
        
        // Remove loading indicator
        Wikiwho.newcontent.css('background', '').css('min-height', '');
        
        // Save author and revision data
        Wikiwho.authors = data.authors;
        Wikiwho.authors_current = data.authors_current;
        Wikiwho.revisions = data.revisions;
        Wikiwho.tokencount = data.tokencount;
        Wikiwho.tokens = data.tokens;
        Wikiwho.revid = parseInt(data.revid);
        
        // Fill right panel with data
        Wikiwho.fillRightPanel();
        
        // Add token events for Wikiwho markup
        Wikiwho.addTokenEvents();
        
        // Add code handling text selections of Wikitext
        Wikiwho.addSelectionEvents();
        
        // Add code to make the history view work
        Wikiwho.addHistoryEvents();
        
        // Handle image selection outlines
        $('.author-token').has("img").addClass("author-token-image");
        
        // Debug output (color tokens in alternating colors)
        // $(".author-token").filter(":odd").css("background-color", "green");
        // $(".author-token").filter(":even").css("background-color", "yellow");
    },
    
    addHistoryEvents: function() {
        // Open history view when open indicator is clicked
        Wikiwho.seqHistBox.click(function() {
            // Check whether open indicator was clicked
            if($(this).hasClass("indicator") && (!$(this).hasClass("indicatortoolong")) && (!$(this).hasClass("indicatoronerev"))) {
                // Calculate height of marked text part
                var selectionHeight = Wikiwho.seqEndToken.offset().top + Wikiwho.seqEndToken.outerHeight(false) - Wikiwho.seqStartToken.offset().top;
                
                // Calculate optimal history view height
                var maxviewheight = $(window).height() - (selectionHeight + 20);
                
                // Check whether selected text is too long
                if((maxviewheight < $(window).height()/5) || (maxviewheight < 150)) {
                    // OK, that's too much at once :(
                    Wikiwho.seqHistBox.addClass("indicatortoolong");
                    return;
                }
                
                // Prepare open animation
                Wikiwho.histview.css("height", "");
                Wikiwho.seqHistBox.css("max-height", Wikiwho.seqHistBox.height()+"px");
                Wikiwho.seqHistBox.removeClass("indicator");
                Wikiwho.seqHistBox.animate({"max-height": maxviewheight+"px"}, 500, function() {
                    Wikiwho.seqHistBox.css("max-height", "calc(100% - "+(selectionHeight + 20)+"px)");
                    
                    // Fix sizes
					$(window).resize();
                });
                
                // Mark history view as open
                Wikiwho.historyViewOpen = true;
                
                // Reset some variables
                Wikiwho.hvhiddenTokens = new Array();
                Wikiwho.hvhiddenRevisions = new Array();
                Wikiwho.hvhiddenTokenDummies = new Array();
                
                // Remove body scrollbars
                $("body").css("overflow", "hidden");
                
                // Scroll body to text passage
                $('html, body').animate({
                    scrollTop: Wikiwho.seqStartToken.offset().top - 10
                }, 500);
                
                // Get start and end ID
                var startTokenId = parseInt(Wikiwho.seqStartToken.attr("class").match(/author-tokenid-([0-9]+)/)[1]);
                Wikiwho.startTokenId = startTokenId;
                var endTokenId = parseInt(Wikiwho.seqEndToken.attr("class").match(/author-tokenid-([0-9]+)/)[1]);
                if(Wikiwho.selectionEndTokenClass) {
                    endTokenId = parseInt(Wikiwho.selectionEndTokenClass.match(/author-tokenid-([0-9]+)/)[1]) - 1;
                }
                Wikiwho.endTokenId = endTokenId;
                
                // Clear and reset history view
                Wikiwho.histview.empty();
                var leftbox = $('<div id="wikiwhoseqhistleftbox"></div>').appendTo(Wikiwho.histview);
        		var middlebox = $('<div id="wikiwhoseqhistmiddlebox"></div>').appendTo(Wikiwho.histview);
        		var rightbox = $('<div id="wikiwhoseqhistrightbox"></div>').appendTo(Wikiwho.histview);
                
                // Populate history view
                var revisionsById = {};
                var revisionArr = new Array();
                revisionArr.push(Wikiwho.revid);
                revisionsById[Wikiwho.revid] = moment.utc(Wikiwho.revisions[Wikiwho.revid]["timestamp"]);
                var compiledTokens = new Array();
                
                for (i = startTokenId; i <= endTokenId; i++) {
                    var token = Wikiwho.tokens[i];
                    var tokenrevlist = new Array();
                    
                    var revid = parseInt(token["revid"]);
                    if(!(revid in revisionsById)) {
                        revisionArr.push(revid);
                        revisionsById[revid] = moment.utc(Wikiwho.revisions[revid]["timestamp"]);
                    }
                    tokenrevlist.push(revid);
                    
                    token["in"].forEach(function(entry) {
                        var revid = parseInt(entry);
                        
                        if(!(revid in revisionsById)) {
                        	revisionArr.push(revid);
                            revisionsById[revid] = moment.utc(Wikiwho.revisions[revid]["timestamp"]);
                    	}
                        
                        tokenrevlist.push(revid);
                    });
                    
                    token["out"].forEach(function(entry) {
                        var revid = parseInt(entry);
                        
                        if(!(revid in revisionsById)) {
                            revisionArr.push(revid);
                            revisionsById[revid] = moment.utc(Wikiwho.revisions[revid]["timestamp"]);
                        }
                        
                        tokenrevlist.push(revid);
                    });
                    
                    tokenrevlist.sort(function(a, b){
                        var aD = revisionsById[a];
                        var bD = revisionsById[b];
                        return aD>bD ? -1 : aD<bD ? 1 : 0;
                    });
                    
                    compiledTokens.push(tokenrevlist);
                }
                
                revisionArr.sort(function(a, b){
                	var aD = revisionsById[a];
                    var bD = revisionsById[b];
                    return aD>bD ? -1 : aD<bD ? 1 : 0;
                });
                
                for(i = 0; i < revisionArr.length; i++){
                    var revinfoline = $('<div class="hvrevhead hvrevhead-'+revisionArr[i]+'"></div>').appendTo(leftbox);
                    
                    // Show diff links
                    // TODO: Check and maybe escape article title
                    if(i != 0) revinfoline.append($('<div class="hvrevdifflinks"><a target="_blank" href="/w/index.php?title='+$("h1#firstHeading").text()+'&amp;diff='+Wikiwho.revid+'&amp;oldid='+revisionArr[i]+'"><img src="http://wikicolor.net/ArticleSearch.svg" class="hvdifficon"/></a></div>'));
                    var updownarrow = $('<span class="hvupdownarrow"></span>');
                    $('<a target="_blank" href="/w/index.php?title='
                      +$("h1#firstHeading").text()
                      +'&amp;diff='
                      +revisionArr[i]
                      +'&amp;oldid='
                      +Wikiwho.revisions[revisionArr[i]]["parentid"]
                      +'" title="'
                      +$("h1#firstHeading").text()
                      +'"></a>').html("&#8597;").appendTo(updownarrow);
                    
                    // Append date and time
                    revinfoline.append($('<div class="hvrevdate"></div>').text(revisionsById[revisionArr[i]].format('YYYY-MM-DD')));
                    
                    // Append spacer
                    revinfoline.append($('<div class="hvspacer"></div>'));
                    
                    // Append author
                    revinfoline.append($('<div class="hvrevauthor"></div>').text(Wikiwho.authors[Wikiwho.revisions[revisionArr[i]]['userid']].name).addClass("hvauthorid-"+Wikiwho.revisions[revisionArr[i]]['userid']).append($('<div class="hvspacerauth">                                   </div>')));
                    
                    // Append distance to next revision in list
                    if(i != revisionArr.length - 1) {
                        var datetimediff = $('<div class="hvdatetimediff"></div>');
                        revinfoline.append(datetimediff);
                        datetimediff.append($('<span class="hvlefttimediff"></span>').text(revisionsById[revisionArr[i+1]].from(revisionsById[revisionArr[i]], true)));
                        datetimediff.append(updownarrow);
                        
                        // Calculate distance in revisions
                        // TODO: Make this more efficient (maybe restructure data sent from API?)
                        var counter = 0;
                        var iterrevid = revisionArr[i];
                        var targetid = revisionArr[i+1];
                        while(iterrevid != targetid) {
                            counter++;
                            iterrevid = Wikiwho.revisions[iterrevid]['parentid'];
                        }
                        
                        datetimediff.append($('<span class="hvrighttimediff"></span>').text(counter + (counter==1 ? " revision" : " revisions")));
                    }
                }
                
                var tokenheaders = $('<div class="hvtokenheaders"></div>').appendTo(middlebox);
                var tokenbodies = $('<div class="hvtokenbodies"></div>').appendTo(middlebox);
                
                for (i = startTokenId; i <= endTokenId; i++) {
                    var token = Wikiwho.tokens[i];
                    var htmltoken = $('<span></span>').text(token["str"]);
                    htmltoken.addClass("author-token");
                    htmltoken.addClass("token-authorid-"+token["authorid"]);
                    htmltoken.addClass("author-tokenid-"+i);
                    tokenheaders.append($('<div class="hvtokenhead hvtokenhead-'+i+'"></div>').append(htmltoken));
                    var tokencol = $('<div class="hvtokencol hvtokencol-'+i+'"></div>').appendTo(tokenbodies);
                    var tokenwidth = htmltoken.parent().outerWidth(true);
                    var tokenrevindex = 0;
                    var tokeninarticle = true;
                    for (var revindex = 0; revindex < revisionArr.length - 1; revindex++) {
                        if(revisionArr[revindex] == compiledTokens[i-startTokenId][tokenrevindex]) {
                            tokeninarticle = !tokeninarticle;
                            tokenrevindex++;
                        }
                        tokencol.append($('<div style="width: ' + (tokenwidth  -2) + 'px;" class="hvtokencolpiece hvtokencolpiece-'+revisionArr[revindex]+' ' + (tokeninarticle ? "hvtokeninarticle" : "hvtokennotinarticle")  + '"></div>'));
                    }
                }
                
                // Fix scrolling
                tokenheaders.bind('wheel', function(e){
                    var scrollTo = e.originalEvent.deltaX + tokenbodies.scrollLeft();
                    tokenbodies.scrollLeft(scrollTo);
                });
                leftbox.bind('wheel', function(e){
                    var scrollTo = e.originalEvent.deltaY + tokenbodies.scrollTop();
                    tokenbodies.scrollTop(scrollTo);
                });
                tokenbodies.scroll(function() {
                    tokenheaders.scrollLeft($(this).scrollLeft());
                    leftbox.scrollTop($(this).scrollTop());
                });
                tokenheaders.append($('<div class="hvtokenheadspacer"></div>'));
                
                // Add resizing events
                $(window).resize(function() {
                    if(leftbox.get(0).scrollHeight >= Wikiwho.seqHistBox.height()) {
                    	Wikiwho.histview.css("height", "calc("+($(window).height() - (selectionHeight + 20))+"px - 2.75em - 1px)");
                    }else{
                    	Wikiwho.histview.css("height", "");
                    }
                });
                
                // Check for special case (only one revision in list)
                if(revisionArr.length == 1) {
                    Wikiwho.seqHistBox.addClass("indicator");
                    Wikiwho.seqHistBox.addClass("indicatoronerev");
                    
                    // Remove resizing events
                    $(window).off("resize");
                    
                    // Mark history view as closed
                    Wikiwho.historyViewOpen = false;
                    
                    // Restore body scrollbars
                    $("body").css("overflow", "");
                }
                
                // Add author click events
                leftbox.find(".hvrevauthor").click(function() {
                    var authorid = $(this).attr('class').match(/hvauthorid-([a-f0-9]+)/)[1];

                    $(".authEntry-"+authorid).click();

                    return false;
                });

                // Add author hover events
                leftbox.find(".hvrevauthor").hover(function(event) {
                    // Mousein event handler
                    var authorid = $(this).attr('class').match(/hvauthorid-([a-f0-9]+)/)[1];
                    
                    // Call the general hover handler
                    Wikiwho.hoverToken(authorid);
                }, function(event) {
                    // Mouseout event handler
                    Wikiwho.deselectTimeout = setTimeout(function(){
                        // Remove all selection markers
                        $(".author-token").removeClass("selected");
                        $(".author-token").removeClass("hvselected");
                        $(".hvrevauthor").removeClass("selected");
                        $("#wikiwhorightbar li").removeClass("selected");
                    }, 500);
                });
                
                // Color tokens
                Object.keys(Wikiwho.coloredAuthors).forEach(function(authorid) {
                    var color = Wikiwho.coloredAuthors[authorid];
                    var contrastColor = Wikiwho.getContrastingColor(color);
                    $(".token-authorid-"+authorid).css("background-color", color);
                    $(".token-authorid-"+authorid).css("color", contrastColor[0]).find("*").css("color", contrastColor[1]);
                    $(".hvauthorid-"+authorid).css("background-color", color);
                    $(".hvauthorid-"+authorid).css("color", contrastColor[0]);
                });
                
                // Color tokens differently if conflict view open
                if(Wikiwho.conflictViewOpen) {
                    Wikiwho.openConflictView();
                }
                
                // Add hover events
                $('div.hvtokenheaders span.author-token').hover(function(event) {
                    // Mousein event handler
                    var authorid = $(this).attr('class').match(/token-authorid-([a-f0-9]+)/)[1];
                    var tokenid = $(this).attr('class').match(/author-tokenid-([a-f0-9]+)/)[1];

                    // Call the general hover handler
                    Wikiwho.hoverToken(authorid);
                    
                    // Select token with red outline
                    $(".author-tokenid-"+tokenid).removeClass("selected").addClass("hvselected");
                }, function(event) {
                    // Mouseout event handler
                    Wikiwho.deselectTimeout = setTimeout(function(){
                        // Remove all selection markers
                        $(".author-token").removeClass("selected");
                        $(".author-token").removeClass("hvselected");
                        $(".hvrevauthor").removeClass("selected");
                        $("#wikiwhorightbar li").removeClass("selected");
                    }, 500);
                });
                
                // Add click events
                $('div.hvtokenheaders span.author-token').click(function() {
                    var authorid = $(this).attr('class').match(/token-authorid-([a-f0-9]+)/)[1];

                    $(".authEntry-"+authorid).click();

                    return false;
                });
                
                // Add hide events (rightclick)
                $('div.hvtokenheaders span.author-token').bind("contextmenu",function(e){
                    var authorid = $(this).attr('class').match(/token-authorid-([a-f0-9]+)/)[1];
                    var tokenid = $(this).attr('class').match(/author-tokenid-([a-f0-9]+)/)[1];
                    
                    Wikiwho.hvHideToken(parseInt(tokenid), parseInt(authorid), revisionArr, compiledTokens, revisionsById, true);
                    
                    return false;
                });
                
                // Open history view
                Wikiwho.seqHistBox.animate({"max-height": maxviewheight+"px"}, 500, function() {
                    Wikiwho.seqHistBox.css("max-height", "calc(100% - "+(selectionHeight + 20)+"px)");
                    
                    // Fix sizes
					$(window).resize();
                });
            }
        });
        
        // Close history box when close icon is clicked
        $("img.hvcloseicon").click(function() {
            // Remove resizing events
            $(window).off("resize");
            
            // Close animation
            Wikiwho.seqHistBox.css("max-height", Wikiwho.seqHistBox.outerHeight(false) + "px");
            Wikiwho.seqHistBox.animate({"max-height": "0px"}, 500, function() {
            	Wikiwho.seqHistBox.hide();
                Wikiwho.seqHistBox.css("max-height", "");
                // Restore body scrollbars
                $("body").css("overflow", "");
            });
            
            // Mark history view as closed
            Wikiwho.historyViewOpen = false;
        });
    },
    
    hvHideToken: function(tokenid, authorid, revisionArr, compiledTokens, revisionsById, animation) {
        Wikiwho.hvhiddenTokens.push(tokenid);
        
        // Search for already matching token dummies
        var foundDummies = new Array();
        for(i = 0; i < Wikiwho.hvhiddenTokenDummies.length; i++) {
            var dummy = Wikiwho.hvhiddenTokenDummies[i];
            
            // Check for removed dummies
            if(dummy == undefined) continue;
            
            if ((dummy["start"] == tokenid + 1) || (dummy["end"] == tokenid - 1)) {
                foundDummies.push(dummy);
            }
        }
        
        // Check how many matching dummies were found
        if(foundDummies.length == 0) {
            // No dummy matching, add one
            var newid = Wikiwho.hvhiddenTokenDummies.length;
            var htmltoken = $('<span></span>').text("[...]");
            var dummyobj = $('<div class="hvtokenhead hvtokenheaddummy hvtokenheaddummy-'+newid+'"></div>').append(htmltoken).insertAfter($('div.hvtokenheaders span.author-tokenid-'+tokenid).parent());
            var tokencol = $('<div class="hvtokencol hvtokendummycol hvtokendummycol-'+newid+'"></div>').insertAfter($('div.hvtokenbodies div.hvtokencol-'+tokenid));
            var tokenwidth = htmltoken.parent().outerWidth(true);
            for (var revindex = 0; revindex < revisionArr.length - 1; revindex++) {
                tokencol.append($('<div style="width: ' + (tokenwidth  -2) + 'px;" class="hvtokencolpiece hvtokencolpiece-'+revisionArr[revindex]+' hvtokencoldummy"></div>'));
            }
            
            var dummy = {
                'start': tokenid,
                'end': tokenid,
                'object': dummyobj,
                'colobj': tokencol,
                'id': newid
            };
            
            dummyobj.click(function() {
                Wikiwho.hvRestoreDummy(dummy, revisionArr, compiledTokens, revisionsById, true);
            });
            
            Wikiwho.hvhiddenTokenDummies[newid] = dummy;
            
            // Animation
            var dummywidth = dummyobj.width();
            var tokencolwidth = tokencol.width();
            if(animation) {
                dummyobj.css('width', '0px');
                tokencol.css('width', '0px');
                dummyobj.animate({'width': dummywidth+'px'}, 500, function() {
                    $(this).css("width", "");
                });
                tokencol.animate({'width': tokencolwidth+'px'}, 500, function() {
                    $(this).css("width", "");
                });
            }
        }else if(foundDummies.length == 1) {
            // One dummy matching, add to dummy
            var dummy = foundDummies[0];
            var dummyid = dummy['id']
            if(dummy['start'] == tokenid + 1) {
                dummy['start']--;
            }else{
                dummy['end']++;
            }
            
            Wikiwho.hvhiddenTokenDummies[dummyid] = dummy;
        }else{
            if(animation) {
                foundDummies[1]['object'].animate({'width': '0px'}, 500, function() {
                    $(this).remove();
                });
                foundDummies[1]['colobj'].animate({'width': '0px'}, 500, function() {
                    $(this).remove();
                });
            }else{
                foundDummies[1]['object'].remove();
                foundDummies[1]['colobj'].remove();
            }
            if(foundDummies[0]['start'] > foundDummies[1]['start']) foundDummies[0]['start'] = foundDummies[1]['start'];
            if(foundDummies[0]['end'] < foundDummies[1]['end']) foundDummies[0]['end'] = foundDummies[1]['end'];
            Wikiwho.hvhiddenTokenDummies[foundDummies[1]['id']] = undefined;
        }
        
        // Actual hiding of token column
        if(animation) {
            $('.hvtokenhead-'+tokenid).animate({'width': '0px'}, 500, function() {
                $(this).hide();
                $(this).css("width", "");
            });
            $('.hvtokencol-'+tokenid).animate({'width': '0px'}, 500, function() {
                $(this).hide();
                $(this).css("width", "");
            });
        }else{
            $('.hvtokenhead-'+tokenid).hide();
            $('.hvtokencol-'+tokenid).hide();
        }
        
        // Rehide rows that should already be hidden (in case a new dummy was added)
        for(i = 0; i < Wikiwho.hvhiddenRevisions.length; i++) {
            $('.hvrevhead-'+Wikiwho.hvhiddenRevisions[i]).hide();
            $('.hvtokencolpiece-'+Wikiwho.hvhiddenRevisions[i]).hide();
        }
        
        // Check whether we can hide rows as well
        var newRevisionArray = new Array();
        for(i = 0; i < compiledTokens.length; i++) {
            // Skip token if hidden
            if(Wikiwho.hvhiddenTokens.indexOf(Wikiwho.startTokenId + i) != -1) {
                continue;
            }
            // Add revisions of this token to array if not already in there
            for(i2 = 0; i2 < compiledTokens[i].length; i2++) {
                if(newRevisionArray.indexOf(compiledTokens[i][i2]) == -1) {
                    newRevisionArray.push(compiledTokens[i][i2]);
                }
            }
        }
        // Go through real revision array and hide all revisions that are not in the new revision array and not already hidden
        for(i = 1; i < revisionArr.length; i++) {
            if(newRevisionArray.indexOf(revisionArr[i]) == -1) {
                // Revision not in new revision array
                if(Wikiwho.hvhiddenRevisions.indexOf(revisionArr[i]) == -1) {
                    // Not hidden yet, hide
                    if(animation) {
                        $('.hvrevhead-'+revisionArr[i]).animate({'height': '0px'}, 500, function() {
                            $(this).hide();
                            $(this).css("height", "");
                        });
                        $('.hvtokencolpiece-'+revisionArr[i]).animate({'height': '0px'}, 500, function() {
                            $(this).hide();
                            $(this).css("height", "");
                        });
                    }else{
                        $('.hvrevhead-'+revisionArr[i]).hide();
                        $('.hvtokencolpiece-'+revisionArr[i]).hide();
                    }
                    
                    // Get index of previous shown revision
                    var previousRevIndex = i - 1;
                    while(Wikiwho.hvhiddenRevisions.indexOf(revisionArr[previousRevIndex]) != -1) {
                        previousRevIndex--;
                    }
                    
                    // Get index of next shown revision
                    var nextRevIndex = i + 1;
                    while((nextRevIndex < revisionArr.length) && (Wikiwho.hvhiddenRevisions.indexOf(revisionArr[nextRevIndex]) != -1)) {
                        nextRevIndex++;
                    }
                    if(nextRevIndex == revisionArr.length) {
                        // Shouldn't show a diff
                        // TODO
                    }else{
                        // Calculate and update new date diff data of previous shown revision
                        $('.hvrevhead-'+revisionArr[previousRevIndex]+' .hvlefttimediff').text(revisionsById[revisionArr[nextRevIndex]].from(revisionsById[revisionArr[previousRevIndex]], true));

                        // Calculate distance in revisions
                        // TODO: Make this more efficient (maybe restructure data sent from API?)
                        var counter = 0;
                        var iterrevid = revisionArr[previousRevIndex];
                        var targetid = revisionArr[nextRevIndex];
                        while(iterrevid != targetid) {
                            counter++;
                            iterrevid = Wikiwho.revisions[iterrevid]['parentid'];
                        }

                        // Update distance in revisions
                        $('.hvrevhead-'+revisionArr[previousRevIndex]+' .hvrighttimediff').text(counter + (counter==1 ? " revision" : " revisions"));
                    }
                    
                    // Add to hvhiddenRevisions array
                    Wikiwho.hvhiddenRevisions.push(revisionArr[i]);
                }
            }
        }
    },
    
    hvRestoreDummy: function(dummy, revisionArr, compiledTokens, revisionsById, animation) {
        // Remove dummy objects
        dummy['object'].remove();
        dummy['colobj'].remove();
        
        // Show token columns again
        for(i = dummy["start"]; i <= dummy["end"]; i++) {
            // Actual showing of token column
            var headwidth = $('.hvtokenhead-'+i).width();
            var colwidth = $('.hvtokencol-'+i).width();
            if(animation) {
                $('.hvtokenhead-'+i).css('width', '0px');
                $('.hvtokencol-'+i).css('width', '0px');
            }
            $('.hvtokenhead-'+i).show();
            $('.hvtokencol-'+i).show();
            if(animation) {
                $('.hvtokenhead-'+i).animate({'width': headwidth+'px'}, 500, function() {
                    $(this).css("width", "");
                });
                $('.hvtokencol-'+i).animate({'width': colwidth+'px'}, 500, function() {
                    $(this).css("width", "");
                });
            }
            
            // Remove tokens from hidden tokens array
            Wikiwho.hvhiddenTokens.splice(Wikiwho.hvhiddenTokens.indexOf(i), 1);
        }
        
        // Remove dummy from array
        Wikiwho.hvhiddenTokenDummies[dummy['id']] = undefined;
        
        // Check whether we can show rows as well
        var newRevisionArray = new Array();
        for(i = 0; i < compiledTokens.length; i++) {
            // Skip token if hidden
            if(Wikiwho.hvhiddenTokens.indexOf(Wikiwho.startTokenId + i) != -1) {
                continue;
            }
            // Add revisions of this token to array if not already in there
            for(i2 = 0; i2 < compiledTokens[i].length; i2++) {
                if(newRevisionArray.indexOf(compiledTokens[i][i2]) == -1) {
                    newRevisionArray.push(compiledTokens[i][i2]);
                }
            }
        }
        // Go through real revision array and show all revisions that are in the new revision array and hidden
        for(i = 1; i < revisionArr.length; i++) {
            if(newRevisionArray.indexOf(revisionArr[i]) != -1) {
                // Revision in new revision array
                if(Wikiwho.hvhiddenRevisions.indexOf(revisionArr[i]) != -1) {
                    // Is hidden => show
                    if(animation) {
                        $('.hvrevhead-'+revisionArr[i]).show().animate({'height': '4.5em'}, 500, function() {
                            $(this).css("height", "");
                        });
                        $('.hvtokencolpiece-'+revisionArr[i]).show().animate({'height': '4.5em'}, 500, function() {
                            $(this).css("height", "");
                        });
                    }else{
                        $('.hvrevhead-'+revisionArr[i]).show();
                        $('.hvtokencolpiece-'+revisionArr[i]).show();
                    }
                    
                    // Get index of previous shown revision
                    var previousRevIndex = i - 1;
                    while(Wikiwho.hvhiddenRevisions.indexOf(revisionArr[previousRevIndex]) != -1) {
                        previousRevIndex--;
                    }
                    
                    // Get index of next shown revision
                    var nextRevIndex = i + 1;
                    while((nextRevIndex < revisionArr.length) && (Wikiwho.hvhiddenRevisions.indexOf(revisionArr[nextRevIndex]) != -1)) {
                        nextRevIndex++;
                    }
                    
                    // Correct diff of previous revision
                    // Calculate and update new date diff data of previous shown revision
                    $('.hvrevhead-'+revisionArr[previousRevIndex]+' .hvlefttimediff').text(revisionsById[revisionArr[i]].from(revisionsById[revisionArr[previousRevIndex]], true));

                    // Calculate distance in revisions
                    // TODO: Make this more efficient (maybe restructure data sent from API?)
                    var counter = 0;
                    var iterrevid = revisionArr[previousRevIndex];
                    var targetid = revisionArr[i];
                    while(iterrevid != targetid) {
                        counter++;
                        iterrevid = Wikiwho.revisions[iterrevid]['parentid'];
                    }

                    // Update distance in revisions
                    $('.hvrevhead-'+revisionArr[previousRevIndex]+' .hvrighttimediff').text(counter + (counter==1 ? " revision" : " revisions"));
                    
                    // Correct diff of this revision
                    if(nextRevIndex == revisionArr.length) {
                        // Shouldn't show a diff
                        // TODO
                    }else{
                        // Calculate and update new date diff data of this shown revision
                        $('.hvrevhead-'+revisionArr[i]+' .hvlefttimediff').text(revisionsById[revisionArr[nextRevIndex]].from(revisionsById[revisionArr[i]], true));

                        // Calculate distance in revisions
                        // TODO: Make this more efficient (maybe restructure data sent from API?)
                        var counter = 0;
                        var iterrevid = revisionArr[i];
                        var targetid = revisionArr[nextRevIndex];
                        while(iterrevid != targetid) {
                            counter++;
                            iterrevid = Wikiwho.revisions[iterrevid]['parentid'];
                        }

                        // Update distance in revisions
                        $('.hvrevhead-'+revisionArr[i]+' .hvrighttimediff').text(counter + (counter==1 ? " revision" : " revisions"));
                    }
                    
                    // Remove from hvhiddenRevisions array
                    Wikiwho.hvhiddenRevisions.splice(Wikiwho.hvhiddenRevisions.indexOf(revisionArr[i]), 1);
                }
            }
        }
    },
    
    addSelectionEvents: function() {
        $("html").mouseup(function(e) {
            if (window.getSelection) {
                // Cancel if history view is already opened
                if(Wikiwho.historyViewOpen) {
                	return;
                }
                
                // Cancel if mouse is at open indicator / hist box
                if(Wikiwho.seqHistBox.css("display") != "none") {
                    var relX = e.pageX - Wikiwho.seqHistBox.offset().left;
                    var relY = e.pageY - Wikiwho.seqHistBox.offset().top;
                    if((relX >= 0) && (relY >= 0) && (relX < Wikiwho.seqHistBox.outerWidth()) && (relY < Wikiwho.seqHistBox.outerHeight())) {
                        return;
                    }
                }
                
            	selectionRange = window.getSelection().getRangeAt(0);
                
                // Check whether something is selected
                if(!selectionRange.collapsed) {
                    
                    // Set start and end container (should be spans)
                    firstToken = $(selectionRange.startContainer.parentElement);
                	lastToken = $(selectionRange.endContainer.parentElement);

                    // Reset some variable
                    Wikiwho.selectionEndTokenClass = undefined;
                    
                    // Don't do anything if we can't associate the selection with author-tokens
                    if(!firstToken.hasClass("author-token")) {
                    	var tempFirstToken = $(selectionRange.startContainer.nextElementSibling);
                        if(tempFirstToken.hasClass("author-token")) {
                            firstToken = tempFirstToken
                        }else{
                            tempFirstToken = firstToken.parent();
                            if(tempFirstToken.hasClass("author-token")) {
                                firstToken = tempFirstToken;
                            }else{
                                return;
                            }
                        }
                    }
                    if(!lastToken.hasClass("author-token")) {
                        var tempLastToken = $(selectionRange.endContainer.previousElementSibling);
                        if(tempLastToken.hasClass("author-token")) {
                            lastToken = tempLastToken
                        }else{
                            tempLastToken = lastToken.parent();
                            if(tempLastToken.hasClass("author-token")) {
                                lastToken = tempLastToken;
                                for(i = 0; i < 3; i++) {
                                    if(tempLastToken.next().hasClass("author-token")) {
                                        Wikiwho.selectionEndTokenClass = tempLastToken.next().attr("class");
                                        break;
                                    }
                                    if(tempLastToken.next().find("span.author-token").length > 0) {
                                        Wikiwho.selectionEndTokenClass = tempLastToken.next().find("span.author-token").first().attr("class");
                                        break;
                                    }
                                    tempLastToken = tempLastToken.parent();
                                }
                            }else{
                                return;
                            }
                        }
                    }
                    
                    
                    // Check whether these start and end tokens are already saved and indicator is shown
                    if(firstToken.is(Wikiwho.seqStartToken) && lastToken.is(Wikiwho.seqEndToken) && (Wikiwho.seqHistBox.css("display") != "none")) {
                        // Cancel and don't reopen the indicator
                        return;
                    }
                    
                    // Save start and end token
                    Wikiwho.seqStartToken = firstToken;
                    Wikiwho.seqEndToken = lastToken;
                    
                    // Calculate height of marked text part
                    var selectionHeight = Wikiwho.seqEndToken.offset().top + Wikiwho.seqEndToken.outerHeight(false) - Wikiwho.seqStartToken.offset().top;
                    
                    // Calculate optimal history view height
                    var maxviewheight = $(window).height() - (selectionHeight + 20);
                    
                    // Check whether selection is too big and if so, notify the user
                    if((maxviewheight < $(window).height()/5) || (maxviewheight < 150)) {
                        Wikiwho.seqHistBox.addClass("indicator");
                        Wikiwho.seqHistBox.addClass("indicatortoolong");
                        Wikiwho.seqHistBox.css("bottom", "-2em");
                        Wikiwho.seqHistBox.animate({"bottom": "0px"}, 300, function() {});
                        Wikiwho.seqHistBox.show();
                        return;
                    }
                    
                    // Show history view indicator
                    Wikiwho.seqHistBox.addClass("indicator");
                    Wikiwho.seqHistBox.removeClass("indicatortoolong");
                    Wikiwho.seqHistBox.removeClass("indicatoronerev");
                    Wikiwho.seqHistBox.css("bottom", "-2em");
                    Wikiwho.seqHistBox.animate({"bottom": "0px"}, 300, function() {});
                    Wikiwho.seqHistBox.show();
                }else{
                    // Hide history view indicator
                    if(!Wikiwho.historyViewOpen) {
                        Wikiwho.seqHistBox.animate({"bottom": "-2em"}, 300, function() {
                            Wikiwho.seqHistBox.hide();
                            Wikiwho.seqHistBox.css("top", "");
                        });
                    }
                }
            }
        });
        
        Wikiwho.newcontent.mousedown(function() {
            
        });
    },
    
    fillRightPanel: function() {
        // Create list box for authors
        var authorListBox = $("#wikiwhoAuthorList").empty();
        
        // Add authors to list box
        for (var i = 0; i < Wikiwho.authors_current.length; i++) {
            var author = Wikiwho.authors_current[i];
            var authentry;
            
            // Anonymous authors don't have a contrib page
            if(!Wikiwho.authors[author.authorid].anon) {
                // TODO: Check whether escaping author name is necessary
            	authentry = $('<li class="authEntry-'+author.authorid+'"><span class="authorCount">'+(author.count*100/Wikiwho.tokencount).toFixed(1)+'%</span></li>').appendTo(authorListBox);
                var authicon = $('<span><a target="_blank" href="http://en.wikipedia.org/wiki/Special:Contributions/'+Wikiwho.authors[author.authorid].name+'"><img src="http://wikicolor.net/UserAvatar.svg" class="wwhouserinfoicon"/></a></span>').appendTo(authentry);
                $('<span>'+Wikiwho.authors[author.authorid].name+'</span>').appendTo(authentry);
                
                (function(author, authicon) {
                    authicon.click(function() {
                        window.open('http://en.wikipedia.org/wiki/Special:Contributions/'+Wikiwho.authors[author.authorid].name);
                        return false;
                    });
                })(author, authicon);
            }else{
                authentry = $('<li class="authEntry-'+author.authorid+'"><span class="authorCount">'+(author.count*100/Wikiwho.tokencount).toFixed(1)+'%</span><span><img src="http://wikicolor.net/UserAvatar.svg" class="wwhouserinfoicon wwhouserinfoiconhidden"/></span><span>'+Wikiwho.authors[author.authorid].name+'</span></li>').appendTo(authorListBox);
            }
            
            // Create click handler (wrap in a closure first so the variables are passed correctly)
            (function(author, authentry) {
                authentry.mousedown(function(e){ e.preventDefault(); });
                authentry.click(function() {
                    if(Wikiwho.coloredAuthors[author.authorid] == undefined) {
                        if(Wikiwho.tokenColors.length == 0) {
                            alert("You can't select any more authors; Please deselect an author first to be able to select another one again.");
                            
                            return;
                        }
                        
                        if(Wikiwho.conflictViewOpen) {
                            alert("Conflict view is opened! Please close the conflict view first.");
                            
                            return;
                        }
                        
                        //var colorindex = Math.floor(Math.random()*Wikiwho.tokenColors.length);
                        var color = Wikiwho.tokenColors.splice(0, 1)[0];
                        var contrastColor = Wikiwho.getContrastingColor(color);
                    	Wikiwho.coloredAuthors[author.authorid] = color;
                    	$(".token-authorid-"+author.authorid).css("background-color", color);
                        $(".token-authorid-"+author.authorid).css("color", contrastColor[0]).find("*").css("color", contrastColor[1]);
                        $(".hvauthorid-"+author.authorid).css("background-color", color);
                        $(".hvauthorid-"+author.authorid).css("color", contrastColor[0]);
                        authentry.css("background-color", color);
                        authentry.css("color", contrastColor[0]);
                    }else{
                        Wikiwho.tokenColors.unshift(Wikiwho.coloredAuthors[author.authorid]);
                        delete Wikiwho.coloredAuthors[author.authorid];
                    	$(".token-authorid-"+author.authorid).css("background-color", "");
                        $(".token-authorid-"+author.authorid).css("color", "").find("*").css("color", "");
                        $(".hvauthorid-"+author.authorid).css("background-color", "");
                        $(".hvauthorid-"+author.authorid).css("color", "");
                        authentry.css("background-color", "");
                        authentry.css("color", "");
                    }
                });
                
                authentry.hover(function(event) {
                    // Mousein event handler
                    
                    // Remove all selection markers
                    $(".author-token").removeClass("selected");
                    $(".author-token").removeClass("hvselected");
                    $(".hvrevauthor").removeClass("selected");
                    $("#wikiwhorightbar li").removeClass("selected");
                    clearTimeout(Wikiwho.deselectTimeout);
                    
                    // Mark all tokens of this author
                    $(".token-authorid-"+author.authorid).addClass("selected");
                    $(".hvauthorid-"+author.authorid).addClass("selected");
                    $(".authEntry-"+author.authorid).addClass("selected");
                }, function(event) {
                    // Mouseout event handler
                    Wikiwho.deselectTimeout = setTimeout(function(){
                        // Remove all selection markers
                        $(".author-token").removeClass("selected");
                        $(".author-token").removeClass("hvselected");
                        $(".hvrevauthor").removeClass("selected");
                        $("#wikiwhorightbar li").removeClass("selected");
                    }, 500);
                });
            })(author, authentry);
        }
    },
    
    hoverToken: function(authorid) {
        // Clear deselect timeout
        clearTimeout(Wikiwho.deselectTimeout);
        
        // Clear "current token" marker
        $(".hvselected").removeClass("hvselected").addClass("selected");
        
        // Clear hvauthor marker
        $(".hvrevauthor").removeClass("selected");
        
        // Determine whether this author is already/still selected
        var selected = $("#wikiwhorightbar li.selected");
        if(selected.length >= 1) {
            var selectedAuthId = selected.attr('class').match(/authEntry-([a-f0-9]+)/)[1];
            if(selected.attr('class').match(/authEntry-([a-f0-9]+)/)[1] == authorid) {
                // Already selected, don't do anything else
                return;
            }
            
            selected.stop( false, true ).stop( false, true ).stop( false, true );
            selected.removeClass("selected");
            $(".token-authorid-"+selectedAuthId).removeClass("selected");
        }
        
        // Scroll the author list to the position of the current entrys author
        Wikiwho.scrollToShowAuthEntry(authorid);
        
        // Mark all tokens of this author
        $(".token-authorid-"+authorid).addClass("selected");
        $(".hvauthorid-"+authorid).addClass("selected");
        $(".authEntry-"+authorid).addClass("selected");
        
        // Flash the author entry
        $(".authEntry-"+authorid).delay(300).fadeOut(100).fadeIn(300);
    },
    
    addTokenEvents: function() {
        var authortokens = $(".author-token");
        
        authortokens.hover(function(event) {
            // Mousein event handler
            var authorid = $(this).attr('class').match(/token-authorid-([a-f0-9]+)/)[1];
            var tokenid = $(this).attr('class').match(/author-tokenid-([a-f0-9]+)/)[1];
            
            // Call the general hover handler
            Wikiwho.hoverToken(authorid);
            
            // If history view is open add red outline to current token
            if((Wikiwho.historyViewOpen) && ($("#wikiwhoseqhistbox .author-tokenid-"+tokenid).length == 1)) {
                // Add outline
                $(".author-tokenid-"+tokenid).removeClass("selected").addClass("hvselected");
                
                // Scroll history view to right position if necessary
                $("#wikiwhoseqhistbox .hvtokenbodies").stop(true);
                var tokenleft = $("#wikiwhoseqhistbox .author-tokenid-"+tokenid).parent().position().left;
                var tokenright = tokenleft + $("#wikiwhoseqhistbox .author-tokenid-"+tokenid).parent().outerWidth();
                var scrollpos = $("#wikiwhoseqhistbox .hvtokenbodies").scrollLeft();
                
                if(tokenleft < 0) {
                    $("#wikiwhoseqhistbox .hvtokenbodies").stop(true).animate({scrollLeft: tokenleft+scrollpos}, 500);
                }else if(tokenright > $("#wikiwhoseqhistbox .hvtokenbodies").width()-2) {
                    $("#wikiwhoseqhistbox .hvtokenbodies").stop(true).animate({scrollLeft: tokenright+scrollpos-$("#wikiwhoseqhistbox .hvtokenbodies").outerWidth()+2}, 500);
                }
            }
        }, function(event) {
        	// Mouseout event handler
            Wikiwho.deselectTimeout = setTimeout(function(){
            	// Remove all selection markers
            	$(".author-token").removeClass("selected");
                $(".author-token").removeClass("hvselected");
                $(".hvrevauthor").removeClass("selected");
            	$("#wikiwhorightbar li").removeClass("selected");
            }, 500);
        });
        
        authortokens.click(function() {
            var authorid = $(this).attr('class').match(/token-authorid-([a-f0-9]+)/)[1];
            
            $(".authEntry-"+authorid).click();
            
            return false;
        });
    },
    
    scrollToShowAuthEntry: function(authorid) {
        // Scroll target
        var authEntry = $('.authEntry-'+authorid);
        
        // Don't try to scroll if there is no target to scroll to
        if(authEntry.length == 0) return;
        
        // Set a few helper Variables
        var authList = $('#wikiwhorightbar');
        var authListTop = authList.scrollTop();
        var listHeight = authList.height();
        var entryTop = authEntry.position().top;
        var entryHeight = authEntry.height();
        
        // Determine whether we have to scroll
        if(entryTop < 0) {
            // Entry is too high, scroll up
            $('#wikiwhorightbar').stop().animate({
                scrollTop: entryTop + authListTop
            }, 300);
        }else if(entryTop > listHeight - entryHeight) {
            // Entry is too low, scroll down
            $('#wikiwhorightbar').stop().animate({
                scrollTop: entryTop + authListTop - listHeight + entryHeight
            }, 300);
        }
    },
    
    openConflictView: function() {
        var tokenValues = new Array();
        var biggestValue = 0;
        
        // Go through all tokens and value them based on ins and outs
        for (i = 0; i < Wikiwho.tokens.length; i++) {
            var token = Wikiwho.tokens[i];
            
            tokenValues[i] = token.in.length + token.out.length;
            
            if(biggestValue < tokenValues[i]) biggestValue = tokenValues[i];
        }
        
        // Do nothing - no conflicts (special case)
        if(biggestValue == 0) return;
        
        // Color all tokens
        for (i = 0; i < tokenValues.length; i++) {
            $('.author-tokenid-'+i).css("background-color", 'rgb(256, '+Math.floor(255*(biggestValue - tokenValues[i])/biggestValue)+', '+Math.floor(255*(biggestValue - tokenValues[i])/biggestValue)+')');
            $('.author-tokenid-'+i).css("color", Wikiwho.getContrastingColorRGB(256, Math.floor(255*(biggestValue - tokenValues[i])/biggestValue), Math.floor(255*(biggestValue - tokenValues[i])/biggestValue))[0]);
        }
        
        // Mark conflict view as open
        $('#conflictviewbutton').addClass("conflictviewopen");
        Wikiwho.conflictViewOpen = true;
    },
    
    closeConflictView: function() {
        // Remove colorization
        $(".author-token").css("background-color", "");
        $(".author-token").css("color", "");
        
        // Recolor tokens
        Object.keys(Wikiwho.coloredAuthors).forEach(function(authorid) {
            var color = Wikiwho.coloredAuthors[authorid];
            var contrastColor = Wikiwho.getContrastingColor(color);
            $(".token-authorid-"+authorid).css("background-color", color);
            $(".token-authorid-"+authorid).css("color", contrastColor[0]).find("*").css("color", contrastColor[1]);
            $(".hvauthorid-"+authorid).css("background-color", color);
            $(".hvauthorid-"+authorid).css("color", contrastColor[0]);
        });
        
        // Mark conflict view as closed
        $('#conflictviewbutton').removeClass("conflictviewopen");
        Wikiwho.conflictViewOpen = false;
    },
    
    // Check whether sth should be done and what (on this specific page)
    pageCheck: function() {
        return $("li#ca-nstab-main").hasClass("selected") && $("li#ca-view").hasClass("selected") && !Wikiwho.contentAlreadyReplaced;
    },
    
    addStyle: function() {
        GM_addStyle("\
#wikiwhorightbar .authorCount {\
float: right;\
}\
#wikiwhorightbar {\
border-bottom: none;\
position: fixed;\
width: calc(15em + 2px);\
bottom: 0px;\
padding: 0px;\
overflow-y: scroll;\
}\
#wikiwhorightbar > div {\
padding: 10px;\
margin: 0px;\
}\
#wikiwhorightbar > div > h2 {\
margin-top: 0px;\
}\
@media screen and (min-width: 982px) {\
#wikiwhorightbar {\
width: calc(15.5em + 2px);\
}\
}\
ul#wikiwhoAuthorList {\
margin: 0px;\
}\
ul#wikiwhoAuthorList li {\
padding: 1px;\
padding-right: 3px;\
padding-left: 3px;\
list-style: none;\
}\
\
ul#wikiwhoAuthorList li:hover, ul#wikiwhoAuthorList li.selected {\
border: 1px solid blue;\
/*border: 1px solid #aaa;*/\
padding: 0px;\
padding-right: 2px;\
padding-left: 2px;\
background-color: #f5fffa;\
}\
.author-token.selected, .hvrevauthor.selected {\
outline: 1px solid blue;\
}\
.hvselected, .author-token-image.hvselected img {\
outline: 1px solid red;\
}\
.author-token-image.hvselected {\
outline: none;\
}\
.author-token-image.selected {\
outline: none;\
}\
.author-token-image.selected img {\
outline: 1px solid blue;\
}\
#wikiwhoseqhistbox {\
background-color: rgb(255, 255, 255);\
position: fixed;\
bottom: 0px;\
right: calc(15em + 3px);\
left: calc(10em + 1px);\
border-top-color: rgb(167, 215, 249);\
border-top-style: solid;\
border-top-width: 1px;\
padding: 1.25em 1.5em 1.5em 1.5em;\
white-space: nowrap;\
box-sizing: border-box;\
}\
@media screen and (min-width: 982px) {\
#wikiwhoseqhistbox {\
right: calc(15.5em + 3px);\
left: calc(11em + 1px);\
}\
}\
#wikiwhoseqhistbox .hvcloseicon {\
position: absolute;\
width: 2em;\
top: 0.25em;\
left: 0.25em;\
cursor: pointer;\
}\
#wikiwhoseqhistbox.indicator .hvcloseicon {\
display: none;\
}\
#wikiwhoseqhistbox.indicator {\
height: 1em;\
padding: 0.5em;\
top: auto;\
box-sizing: content-box;\
}\
#wikiwhoseqhistboxopenindicator {\
text-align: center;\
display: none;\
}\
#wikiwhoseqhistboxonerevindicator {\
text-align: center;\
display: none;\
}\
#wikiwhoseqhistbox.indicator:not(.indicatortoolong):not(.indicatoronerev) #wikiwhoseqhistboxopenindicator {\
display: block;\
}\
#wikiwhoseqhistboxtoolongindicator {\
text-align: center;\
display: none;\
}\
#wikiwhoseqhistbox.indicatortoolong #wikiwhoseqhistboxtoolongindicator {\
display: block;\
}\
#wikiwhoseqhistbox.indicatoronerev #wikiwhoseqhistboxonerevindicator {\
display: block;\
}\
#wikiwhoseqhistleftbox, #wikiwhoseqhistmiddlebox, #wikiwhoseqhistrightbox {\
display: inline-block;\
vertical-align: top;\
height: 100%;\
overflow: hidden;\
}\
#wikiwhoseqhistmiddlebox {\
width: calc(100% - 17em);\
}\
#wikiwhoseqhistbox.indicator #wikiwhoseqhistview {\
display: none;\
}\
#wikiwhoseqhistview {\
position: relative;\
}\
#wikiwhoseqhistview .hvtokencol {\
display: inline-block;\
}\
#wikiwhoseqhistview .hvtokenhead {\
height: 2em;\
line-height: 2em;\
margin-left: 0.1em;\
margin-right: 0.1em;\
display: inline-block;\
vertical-align: bottom;\
}\
#wikiwhoseqhistmiddlebox .hvtokenheaders {\
position: relative;\
overflow: hidden;\
right: 0px;\
left: 0px;\
}\
#wikiwhoseqhistmiddlebox .hvtokenbodies {\
overflow: auto;\
width: 100%;\
height: calc(100% - 2em);\
}\
#wikiwhoseqhistmiddlebox .hvtokencolpiece {\
height: calc(4.5em - 1px);\
width: 100%;\
border-top: dotted 1px blue;\
border-left: 1px solid white;\
border-right: 1px solid white;\
}\
#wikiwhoseqhistmiddlebox .hvtokencolpiece:last-child {\
border-bottom: dotted 1px blue;\
}\
#wikiwhoseqhistmiddlebox .hvtokencolpiece.hvtokeninarticle {\
background-color: rgb(167, 215, 249);\
}\
#wikiwhoseqhistleftbox {\
margin-top: 1.25em;\
height: calc(100% - 1.25em);\
position: relative;\
}\
#wikiwhoseqhistleftbox > div {\
height: 4.5em;\
line-height: 1.5em;\
text-align: right;\
}\
#wikiwhoseqhistleftbox > div:last-of-type {\
height: 1.5em;\
margin-bottom: 20px;\
}\
#wikiwhoseqhistleftbox > div > .hvdatetimediff {\
height: 3em;\
line-height: 3em;\
vertical-align: top;\
}\
#wikiwhoseqhistleftbox > div .hvupdownarrow {\
position: absolute;\
left: 2.5em;\
margin-top: -0.1em;\
font-size: 3em;\
}\
#wikiwhoseqhistleftbox > div .hvupdownarrow a, #wikiwhoseqhistleftbox > div .hvupdownarrow a:hover, #wikiwhoseqhistleftbox > div .hvupdownarrow a:visited, #wikiwhoseqhistleftbox > div .hvupdownarrow a:link, #wikiwhoseqhistleftbox > div .hvupdownarrow a:active {\
color: black;\
text-decoration: none;\
}\
#wikiwhoseqhistleftbox > div .hvupdownarrow a:hover {\
color: blue;\
}\
#wikiwhoseqhistleftbox > div span.hvlefttimediff {\
position: absolute;\
left: 0.5em;\
}\
#wikiwhoseqhistleftbox > div span.hvrighttimediff {\
position: absolute;\
left: 10em;\
}\
#wikiwhoseqhistleftbox .hvrevauthor {\
text-overflow: ellipsis;\
overflow: hidden;\
max-width: 8em;\
}\
#wikiwhoseqhistleftbox .hvspacer, #wikiwhoseqhistleftbox .hvspacerauth {\
border-bottom: 1px dotted blue;\
min-width: 2em;\
display: inline-block;\
vertical-align: top;\
height: 0.75em;\
}\
#wikiwhoseqhistleftbox .hvspacerauth {\
min-width: 0;\
white-space: pre;\
}\
#wikiwhoseqhistleftbox .hvrevauthor, #wikiwhoseqhistleftbox .hvrevdate, #wikiwhoseqhistleftbox .hvrevdifflinks {\
display: inline-block;\
vertical-align: top;\
}\
.hvtokenheadspacer {\
width: 100px;\
display: inline-block;\
}\
img.hvdifficon {\
height: 1.5em;\
}\
.hvtokencol.hvtokendummycol {\
background: rgb(167, 215, 249);\
background-image: repeating-linear-gradient(45deg, transparent, transparent 1em, rgba(255,255,255,.5) 1em, rgba(255,255,255,.5) 2em);\
}\
#conflictviewbutton {\
width: 32px;\
height: 32px;\
float: right;\
background-image: url(\"http://wikicolor.net/Speechbubbles_icon.svg\");\
cursor: pointer;\
}\
#conflictviewbutton.conflictviewopen {\
background-image: url(\"http://wikicolor.net/Speechbubbles_icon_green.svg\");\
}\
img.wwhouserinfoicon {\
height: 1.5em;\
cursor: pointer;\
}\
img.wwhouserinfoiconhidden {\
visibility: hidden;\
cursor: default;\
}\
#wikiwhoAuthorList li span:last-child {\
text-overflow: ellipsis;\
white-space: nowrap;\
overflow: hidden;\
width: calc(100% - 4.5em);\
display: inline-block;\
margin-bottom: -0.4em;\
}\
        ");
    },
    
    // Initialize the Wikiwho Userscript
    initialize: function() {
        if(!Wikiwho.initialized && Wikiwho.pageCheck()) {
            // We're on a web page where we should do something
            Wikiwho.initialized = true;
            Wikiwho.addStyle();
            Wikiwho.createHTMLElements();
            Wikiwho.getWikiwhoData();
        }
    }
};

// Do not run in frames
if (window.top !== window.self) {
  	// Do nothing
}else{
    // Initialize the script as soon as the content text / page is loaded
    function waitForMwContent() {
        if($("#mw-content-text").length > 0) {
            Wikiwho.initialize();
        }else{
            setTimeout(waitForMwContent, 100);
        }
    }
    
    waitForMwContent();
}
