namespace Validation

module Records =
    let findRecord id records = records |> List.tryFind (fun (key, _) -> key = id)

