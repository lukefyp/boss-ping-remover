## Boss Ping Remover
Makes the bosses attacks match up with servers

### Command(s): 
* `BPR` -- Enable/Disable the module

* `BPR debug` -- Enable/Disable the debug output

### Config:
* If you have high ping (200+ ms) 

* if you're using skill prediction (or ping compensation, ping remover, class script, etc)

Make the following changes to `config/config.json`:

```diff
{
    "version": "6.0",
    "enabled": true,
    "debug": false,
    "pingHistoryMax": 30,
-   "pingSpikesLimit": false,
+   "pingSpikesLimit": true,
-   "pingSpikesMin": 100,
+   "pingSpikesMin": X, (X = (your minimum ping) - 10 or 20)
-   "pingSpikesMax": 1000,
+   "pingSpikesMax": Y, (Y = (your normal ping x 2) + 20 or 40)
    "minCombatFPS": 30
}
```