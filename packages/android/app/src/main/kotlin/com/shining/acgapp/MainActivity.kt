package com.shining.acgapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ShiningACGAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen()
                }
            }
        }
    }
}

@Composable
fun MainScreen() {
    var counter by remember { mutableStateOf(0) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Welcome to Shining ACG App",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFFFF3E00)
        )

        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text = "Count: $counter",
            fontSize = 24.sp
        )

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = { counter++ },
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFFF3E00)
            )
        ) {
            Text("Increment", fontSize = 20.sp)
        }
    }
}

@Composable
fun ShiningACGAppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Color(0xFFFF3E00),
            background = Color(0xFFF9F9F9)
        ),
        content = content
    )
}
