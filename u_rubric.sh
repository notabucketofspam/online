#!/usr/bin/sh

solutes/spare_change.sh "opm/dist" "x64/opm.txt"
chopm=$?

solutes/spare_change.sh "copium/build" "x64/copium.txt"
chcopium=$?

if test $chopm -eq 1 -o $chcopium -eq 1;then
  # gotta restart
  echo RESET
  ssh brick "sudo systemctl restart opm"
  # write the hashes down again
  rm "x64/opm.txt" "x64/copium.txt"
  solutes/spare_change.sh "opm/dist" "x64/opm.txt"
  solutes/spare_change.sh "copium/build" "x64/copium.txt"
else
  echo brick OK
fi

echo done
# sleep 2
