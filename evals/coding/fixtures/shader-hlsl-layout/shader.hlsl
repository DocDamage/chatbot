cbuffer Frame : register(b0) { float4x4 viewProjection; };
float4 main(float4 position : POSITION) : SV_Position { return mul(viewProjection, position); }

