// Firefox = browser, Chrome = chrome.
let api;
try {
    api = chrome;
} catch(e) {
    api = browser;
}

// Return the last element in an array.
// If the array is empty, return null.
function last(array) {
    if (!array || array.length === 0)
        return null;
    return array[array.length - 1];
}

// Open the origin url of the given tab.
function openTabOrigin(tab) {
    const id = tab.id.toString();
    api.storage.local.get(id, function(result) {
        const result_stack = result[id] || [];
        if (last(result_stack)) {
            api.tabs.query({url: last(result_stack)}, function(matches) {
                if (matches.length > 0) {
                    console.log("Found switch to " + matches[0].id + ", activating now");
                    api.tabs.update(matches[0].id, {active: true});
                    api.windows.update(matches[0].windowId, {focused: true});
                } else {
                    const dest = last(result_stack);
                    console.log("Opening tab for url " + dest);
                    api.tabs.create({url: dest, index: tab.index}, function(newtab) {
                        // We don't want to set the last tab to the one we just came
                        // from (this one), instead we want to inherit the parent tab
                        // stack so we can keep going all the way back.
                        api.storage.local.set({[newtab.id.toString()]: result_stack.slice(0, -1)});
                    });
                }
            });
        } else {
            console.log("Could not find origin for tab", id);
            api.browserAction.setBadgeText({text: "N/A", tabId: tab.id});
        }
    });
}

api.browserAction.onClicked.addListener(openTabOrigin);

api.tabs.onCreated.addListener(function(tab) {
    if (tab.openerTabId !== undefined) {
        api.tabs.get(tab.openerTabId, function(match) {
            if (match !== undefined) {
                const match_id = match.id.toString();
                const tab_id = tab.id.toString();
                // We set the new tab's history stack to
                // [original tab's history] + original tab's URL.
                // By retaining the entire history stack, we can do the nifty trick of
                // keeping tab origin state across repeated invocations, allowing us to tab
                // origin our way all the way back to the first tab opened.
                api.storage.local.get(match_id, function(result) {
                    const match_stack = result[match_id] || [];
                    // The query API does not match on hash mark, so strip that off.
                    if (match.url.lastIndexOf("#") > -1) {
                        const base = match.url.substr(0, match.url.lastIndexOf("#"));
                        api.storage.local.set({[tab_id]: match_stack.concat([base])});
                    } else {
                        api.storage.local.set({[tab_id]: match_stack.concat([match.url])});
                    }
                });
            } else {
                console.log("Could not find opener for tab " + tab.url);
            }
        });
    } else {
        console.log("ㅠㅠ Undefined opener for tab " + tab.url + " ㅠㅠ");
    }
})

api.tabs.onRemoved.addListener(function(tabId) {
    api.storage.local.set({[tabId.toString()]: []});
});
