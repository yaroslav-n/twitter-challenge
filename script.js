// ==UserScript==
// @name         Twitter Super Search Box
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       Yaroslav
// @match        https://twitter.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=twitter.com
// @grant        none
// ==/UserScript==

const searchboxSelector = "input[data-testid=\"SearchBox_Search_Input\"]";
const typeAheadUrl = "https://twitter.com/i/api/1.1/search/typeahead.json";
const isFromSuggestRegex = /^(from:)([^ ]*)$/;
const ifFromSearchRegex = /^(from:)([^ ]+) (.*)$/;
let hideSuggestionStyleEl;
let timeout;

const addPluginCSS = () => {
    const head = document.head || document.getElementsByTagName('head')[0];
    const typeAheadCss = document.createElement('style');
    head.appendChild(typeAheadCss);
   typeAheadCss.appendChild(document.createTextNode(`
   .pluginSuggestionContainer {
width: 100%;
display: flex;
flex-direction:row;
cursor:pointer;
box-sizing: border-box;
padding: 12px 16px;
font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
   font-size: 15px;
   line-height: 20px;
   }
   .pluginSuggestionContainer:hover {
background-color: rgb(247,249,249);
   }

   .pluginAvatar {
border-radius: 1000px;
height: 56px;
width: 56px;
margin-right: 12px;
   }

   .pluginSuggestionName {
color: rgb(15,20,25);
font-weight: 700;
   }

   .pluginHandle {
   color: rgb(83,100,113);
   }

   .pluginBio {
   max-lines: 1;
   color: rgb(83,100,113);
   text-overflow: ellipsis;
   }
    `));
}

// looking for SearchBox to appear/disappear
const createObserver = (onSearchAdded, onSearchRemoved) => {
  return new MutationObserver(function(mutations_list) {
	mutations_list.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(added_node) {
            if (added_node.querySelector) {
                const searchEl = added_node.querySelector(searchboxSelector);
                if (!!searchEl) {
                    onSearchAdded(searchEl);
                };
            }
        });

        mutation.removedNodes.forEach(function(removed_node) {
            const searchEl = removed_node.querySelector(searchboxSelector);
            if (!!searchEl) {
                onSearchRemoved(searchEl);
            };
        });
    });
  });
}

const getCookie = (cname) => {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

const getTypeAhead = (twitterHandle) => {
    return new Promise((resolve, reject) => {
        const requestUrl = new URL(typeAheadUrl);
        const csrfToken = getCookie("ct0");
        // constant in twitter js code
        const authorization = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

        requestUrl.searchParams.set('include_ext_is_blue_verified', 1);
        requestUrl.searchParams.set('q', `@${twitterHandle}`);
        requestUrl.searchParams.set('src', 'search_box');
        requestUrl.searchParams.set('result_type', 'users');

        const xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", requestUrl.toString(), false);
        xmlHttp.setRequestHeader('x-csrf-token', csrfToken);
        xmlHttp.setRequestHeader('x-twitter-active-user', 'yes');
        xmlHttp.setRequestHeader('x-twitter-auth-type', 'OAuth2Session');
        xmlHttp.setRequestHeader('x-twitter-client-language', 'en');
        xmlHttp.setRequestHeader('authorization', `Bearer ${authorization}`);

        xmlHttp.onload = (e) => {
            if (xmlHttp.readyState === 4) {
                if (xmlHttp.status === 200) {
                    resolve(xmlHttp.responseText);
                } else {
                    reject(xmlHttp.statusText);
                }
            }
        }

        xmlHttp.onerror = (e) => {
            reject(xmlHttp.statusTexT);
        }

        xmlHttp.send(null);
    });
}

// suggestions: [{avatarUrl, name, twitterHandle, bio, isBlueTick}]
const showPluginSuggestions = (suggestions) => {
    // removing all previous suggestions
    const prevSuggestions = document.querySelectorAll('.pluginSuggestionContainer');
    prevSuggestions.forEach(el => el.remove());

    const suggestionsContainer = document.querySelector('div[id^=typeaheadDropdown-]');

    suggestions.forEach(s => {
        const container = document.createElement('div');
        container.classList.add("pluginSuggestionContainer");

        const avatar = document.createElement('img');
        avatar.classList.add("pluginAvatar");
        avatar.setAttribute("src", s.avatarUrl);
        container.appendChild(avatar);

        const textContainer = document.createElement('div');
        textContainer.classList.add("pluginTextContainer");

        const name = document.createElement('div');
        name.classList.add('pluginSuggestionName');
        const nameText = document.createTextNode(s.name);
        name.appendChild(nameText);
        textContainer.appendChild(name);

        const handle = document.createElement('div');
        handle.classList.add('pluginHandle');
        const handleText = document.createTextNode(s.twitterHandle);
        handle.appendChild(handleText);
        textContainer.appendChild(handle);

        const bio = document.createElement('div');
        bio.classList.add('pluginBio');
        const bioText = document.createTextNode(s.bio);
        bio.appendChild(bioText);
        textContainer.appendChild(bio);

        container.appendChild(textContainer);

        container.addEventListener("click", () => {
            const searchEl = document.querySelector(searchboxSelector);
            if (searchEl) {
                searchEl.focus();
                searchEl.value = `from:${s.twitterHandle} `;
                //console.log('>>> searhcEl', searchEl.value);
                //searchEl.focus();
                //console.log('>>> searhcEl', searchEl.value);
            }
        });

        suggestionsContainer.appendChild(container);
    });
}

const hideNativeSuggestions = () => {
    if(!hideSuggestionStyleEl) {
        console.log('>>> hideNativeSuggestions');
        const head = document.head || document.getElementsByTagName('head')[0];
        hideSuggestionStyleEl = document.createElement('style');
        head.appendChild(hideSuggestionStyleEl);
        hideSuggestionStyleEl.appendChild(document.createTextNode(`
div[data-testid="typeaheadResult"] {
display: none !important;
};
    `));
    }
}

const showNativeSuggestions = () => {
    if (hideSuggestionStyleEl) {
        console.log('>>> showNativeSuggestions');;
        hideSuggestionStyleEl.remove()
        hideSuggestionStyleEl = undefined;
    };
}

const onSearchChange = (event) => {
    const text = event.target.value;
    const isFromSuggest = isFromSuggestRegex.test(text);
    const isFromSearch = ifFromSearchRegex.test(text);

    if (isFromSuggest) {
        const match = text.match(isFromSuggestRegex);
        const twitterHandle = match[2];
        if (timeout) {
            clearTimeout(timeout);
        };
        timeout = setTimeout(() => {
            getTypeAhead(twitterHandle).then((resultsText) => {
                console.log('>>>wh');
                const results = JSON.parse(resultsText);

                const suggestions = results.users.map((u) => {

                    return {
                        avatarUrl: u.profile_image_url_https,
                        name: u.name,
                        twitterHandle: u.tokens[1].token,
                        bio: u.result_context.display_string || '',
                        isBlueTick: u.verified || u.ext_is_blue_verified,
                    }});

                showPluginSuggestions(suggestions);
            });
        }, 100);
    }
    if (isFromSearch) {
        const match = text.match(ifFromSearchRegex);
        const twitterHandle = match[2];
        const searchText = match[3];
        console.log('>>> search:', searchText, 'from: ', twitterHandle);
    }

    if (isFromSuggest || isFromSearch) {
        hideNativeSuggestions();
    } else {
        showNativeSuggestions();
    }
};

(function() {
    'use strict';
    // adding our own type-ahead classes as twitter obfuscated native ones
    addPluginCSS();

    const onSearchAdded = (searchEl) => {
        searchEl.addEventListener('input', onSearchChange);
    };

    const onSearchRemoved = (searchEl) => {
        searchEl.removeEventListener('input', onSearchChange);
    }

    const observer = createObserver(onSearchAdded, onSearchRemoved);
    observer.observe(document.querySelector("#react-root"), { subtree: true, childList: true });
})();