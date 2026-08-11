@test "filename is passed as one argument" {
  run bash backup.sh 'a;touch /tmp/pwned' /tmp/out
  [ "$status" -ne 0 ] || [ ! -e /tmp/pwned ]
}
