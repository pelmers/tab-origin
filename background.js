// Firefox = browser, Chrome = chrome.
let api;
try {
    api = chrome;
} catch(e) {
    api = browser;
}
// Map tab id -> [history of url of active tab when it opened]
const trackedTabs = {};

// Return the last element in an array.
// If the array is empty, return null.
function last(array) {
    if (!array || array.length === 0)
        return null;
    return array[array.length - 1];
}

// Open the origin url of the given tab.
function openTabOrigin(tab) {
    let id = tab.id;
    if (last(trackedTabs[id])) {
        // First try to find a tab with this url and switch to it. (if pref enabled)
        api.tabs.query({url: last(trackedTabs[id])}, function(matches) {
            if (matches.length > 0) {
                console.log("Found switch to " + matches[0].id + ", activating now");
                api.tabs.update(matches[0].id, {active: true});
                api.windows.update(matches[0].windowId, {focused: true});
            } else {
                let dest = last(trackedTabs[id]);
                console.log("Opening tab for url " + dest);
                api.tabs.create({url: dest, index: tab.index}, function(tab) {
                    // We don't want to set the last tab to the one we just came
                    // from (this one), instead we want to inherit the parent tab
                    // stack so we can keep going all the way back.
                    trackedTabs[tab.id] = trackedTabs[id].slice(0, -1);
                });
            }
        });
    } else {
        console.log("Could not find origin for tab", id);
        api.browserAction.setBadgeText({text: "N/A", tabId: id});
    }
}

api.browserAction.onClicked.addListener(openTabOrigin);

api.tabs.onCreated.addListener(function(tab) {
    if (tab.openerTabId !== undefined) {
        api.tabs.get(tab.openerTabId, function(match) {
            if (match !== undefined) {
                // We set the new tab's history stack to
                // [original tab's history] + original tab's URL.
                // By retaining the entire history stack, we can do the nifty trick of
                // keeping tab origin state across repeated invocations, allowing us to tab
                // origin our way all the way back to the first tab opened.
                trackedTabs[match.id] = trackedTabs[match.id] || [];
                // The query API does not match on hash mark, so strip that off.
                if (match.url.lastIndexOf("#") > -1) {
                    const base = match.url.substr(0, match.url.lastIndexOf("#"));
                    trackedTabs[tab.id] = trackedTabs[match.id].concat([base]);
                } else {
                    trackedTabs[tab.id] = trackedTabs[match.id].concat([match.url]);
                }
            } else {
                console.log("Could not find opener for tab " + tab.url);
            }
        });
    } else {
        console.log("Undefined opener for tab " + tab.url);
    }
})

api.tabs.onRemoved.addListener(function(tabId) {
    trackedTabs[tabId] = [];
});
