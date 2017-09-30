// TODO: port to browser api
const api = chrome;

const activeTabKey = "activeTab";

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
                    api.tabs.update(matches[0].id, {active: true});
                    api.windows.update(matches[0].windowId, {focused: true});
                } else {
                    const dest = last(result_stack);
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

function updateOpenerState(newTab, openerTab) {
    const match_id = openerTab.id.toString();
    const tab_id = newTab.id.toString();
    // We set the new tab's history stack to
    // [original tab's history] + original tab's URL.
    // By retaining the entire history stack, we can do the nifty trick of
    // keeping tab origin state across repeated invocations, allowing us to tab
    // origin our way all the way back to the first tab opened.
    api.storage.local.get(match_id, function (result) {
        const match_stack = result[match_id] || [];
        // The query API does not match on hash mark, so strip that off.
        if (openerTab.url.lastIndexOf("#") > -1) {
            const base = openerTab.url.substr(0, openerTab.url.lastIndexOf("#"));
            api.storage.local.set({ [tab_id]: match_stack.concat([base]) });
        } else {
            api.storage.local.set({ [tab_id]: match_stack.concat([openerTab.url]) });
        }
    });

}

api.browserAction.onClicked.addListener(openTabOrigin);

// Remark: on new tab creation, we receive onCreated before onActivated.
api.tabs.onActivated.addListener(info => {
    const id = info.tabId;
    api.storage.local.set({[activeTabKey]: id});
});

api.tabs.onCreated.addListener(function(tab) {
    if (tab.openerTabId !== undefined) {
        api.tabs.get(tab.openerTabId, function(match) {
            if (match !== undefined) {
                updateOpenerState(tab, match);
            } else {
                console.log("Opener is defined, but I can't find it for " + tab.url);
            }
        });
    } else {
        //TODO: file a bug!
        // in firefox openerTabId is not set for tabs opened by alt-enter in address bar.
        // (it's only set for tabs opened from links on the page)
        api.storage.local.get(activeTabKey, tabId => {
            api.tabs.get(tabId[activeTabKey], match => {
                if (match !== undefined) {
                    updateOpenerState(tab, match);
                } else {
                    console.log("Attempted to use active tab as opener, but it was not set.");
                }
            });
        });
    }
})

api.tabs.onRemoved.addListener(function(tabId) {
    api.storage.local.set({[tabId.toString()]: []});
});
