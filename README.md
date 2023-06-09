# Totoro in the Rain
**CS174A Final Project**<br>
**Carson Cox, Arvin Ding, Justin Li, Megan Wu**

## Concept
This project is a recreation of a scene from My Neighbor Totoro. The original scene features the two main characters, Mei and Satsuki, handing an umbrella to Totoro.<br>

Our recreation is split into three scenes:
1) A streetlight turns on, showing two umbrellas; Totoro walks onto the scene
2) Totoro loiters at the streetlight. This scene is **interactive** (see Features below)
3) Totoro takes one of the umbrellas and disappears into the forest

## Interactive Features
In Scene 2, users can interact with Totoro and other aspects of the scene. Here are all possible user commands:
* *(L)* Toggle streetlight on/off
* *(R)* Toggle rain on/off
* *(T)(Shift+T)* Slow down/speed up time. At time scale 0.00032, you can see rain bouncing off the ground
* *(Mouse select)* Click on an umbrella to select which one to open/close
* *(U)* Open/close selected umbrella
* *(J)* Make Totoro jump; when he lands, extra raindrops fall down

## Advanced Features
We implemented three advanced features for our project:
* Shadows for Totoro and umbrellas
* Mouse Picking to select which umbrella to open/close
* Collision Detection to make rain bounce off the ground